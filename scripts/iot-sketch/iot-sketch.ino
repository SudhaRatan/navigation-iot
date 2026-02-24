#include <Wire.h>
#include <U8g2lib.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include "mbedtls/base64.h"
#include "MPU9250.h"

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
MPU9250 mpu;
/*
 Pins on your display:
 GND  -> GND
 VDD  -> 3V3
 SCK  -> 12 (SCL)
 SDA  -> 11 (SDA)
*/

// Use SH1106 driver (works with most 4-pin modules)
U8G2_SH1106_128X64_NONAME_F_HW_I2C display(
  U8G2_R2,          // 180° rotation (change to U8G2_R0 if upside down)
  U8X8_PIN_NONE
);

String mapBuffer = "";
String secBuffer = "";

bool receivingMap = false;
bool receivingSec = false;

uint8_t secBinary[16384];   // adjust if needed
int secBinaryLen = 0;

uint8_t mapBinary[16384];   // adjust if needed
int mapBinaryLen = 0;

class MyServerCallbacks: public BLEServerCallbacks {

  void onConnect(BLEServer* pServer) {

    display.clearBuffer();
    display.setFont(u8g2_font_6x10_tf);
    display.drawStr(10, 30, "DEVICE CONNECTED");
    display.sendBuffer();
  }

  void onDisconnect(BLEServer* pServer) {

    mapBuffer = "";
    secBuffer = "";

    secBinaryLen = 0;

    mapBinaryLen = 0;
    display.clearBuffer();
    display.setFont(u8g2_font_6x10_tf);
    display.drawStr(10, 30, "CONNECT DEVICE");
    display.sendBuffer();
    BLEDevice::startAdvertising(); // restart advertising
  }
};

// --- COHEN-SUTHERLAND CLIPPING ALGORITHM ---
const int INSIDE = 0; // 0000
const int LEFT   = 1; // 0001
const int RIGHT  = 2; // 0010
const int BOTTOM = 4; // 0100
const int TOP    = 8; // 1000

int computeOutCode(int16_t x, int16_t y) {
  int code = INSIDE;
  if (x < 0) code |= LEFT;
  else if (x > 127) code |= RIGHT;
  if (y < 0) code |= TOP;
  else if (y > 63) code |= BOTTOM;
  return code;
}

bool clipLine(int16_t &x0, int16_t &y0, int16_t &x1, int16_t &y1) {
  int outcode0 = computeOutCode(x0, y0);
  int outcode1 = computeOutCode(x1, y1);
  bool accept = false;

  while (true) {
    if (!(outcode0 | outcode1)) {
      accept = true; 
      break;
    } else if (outcode0 & outcode1) {
      break; 
    } else {
      int outcodeOut = outcode0 ? outcode0 : outcode1;
      int16_t x = 0, y = 0;

      // The ternary operators prevent divide-by-zero crashes
      if (outcodeOut & TOP) {           
        x = x0 + (x1 - x0) * (0 - y0) / (y1 - y0 != 0 ? y1 - y0 : 1); y = 0;
      } else if (outcodeOut & BOTTOM) { 
        x = x0 + (x1 - x0) * (63 - y0) / (y1 - y0 != 0 ? y1 - y0 : 1); y = 63;
      } else if (outcodeOut & RIGHT) {  
        y = y0 + (y1 - y0) * (127 - x0) / (x1 - x0 != 0 ? x1 - x0 : 1); x = 127;
      } else if (outcodeOut & LEFT) {   
        y = y0 + (y1 - y0) * (0 - x0) / (x1 - x0 != 0 ? x1 - x0 : 1); x = 0;
      }

      if (outcodeOut == outcode0) {
        x0 = x; y0 = y; outcode0 = computeOutCode(x0, y0);
      } else {
        x1 = x; y1 = y; outcode1 = computeOutCode(x1, y1);
      }
    }
  }
  return accept;
}

float heading_degrees = 0.0;
unsigned long lastDrawTime = 0;

// --- CAMERA ANIMATION GLOBALS ---
double targetRiderX = 0;
double targetRiderY = 0;
double currentRiderX = 0.0;
double currentRiderY = 0.0;

// --- GPS TO PIXEL CONVERSION GLOBALS ---
bool originSet = false;
double originLat = 0.0;
double originLon = 0.0;

void drawSecondaryRoads() {
  display.clearBuffer();
  if (secBinaryLen < 5) return;
  const int CENTER_X = 64;
  const int CENTER_Y = 32;

  // --- 1. SMOOTH CAMERA PANNING (LERP) ---
  // Move current position 10% closer to the target every frame
  currentRiderX += (targetRiderX - currentRiderX) * 0.1;
  currentRiderY += (targetRiderY - currentRiderY) * 0.1;

  int16_t prevX = 0;
  int16_t prevY = 0;

  // Convert dynamic degrees to radians
  float heading_radians = heading_degrees * (PI / 180.0);
  float s = sin(heading_radians);
  float c = cos(heading_radians);

  // Process 5 bytes at a time: [CMD, X_Low, X_High, Y_Low, Y_High]
  for (int i = 0; i <= secBinaryLen - 5; i += 5) {
    uint8_t cmd = secBinary[i];

    // Reconstruct the 16-bit signed integers (Little Endian)
    int16_t mapX = secBinary[i + 1] | (secBinary[i + 2] << 8);
    int16_t mapY = secBinary[i + 3] | (secBinary[i + 4] << 8);

    // --- 2. APPLY CAMERA OFFSET ---
    // Shift the map in the opposite direction of the rider
    float relX = mapX - currentRiderX;
    float relY = mapY - currentRiderY;

    // --- 3. ROTATION ---
    // Rotate the shifted coordinates around the origin
    int16_t rotX = round((relX * c) - (relY * s));
    int16_t rotY = round((relX * s) + (relY * c));

    // --- 4. TRANSLATE TO SCREEN CENTER ---
    int16_t screenX = CENTER_X + rotX;
    int16_t screenY = CENTER_Y + rotY;

    // --- 5. CLIP AND DRAW ---
    if (cmd == 1) { 
      int16_t px = prevX, py = prevY, cx = screenX, cy = screenY;
      if (clipLine(px, py, cx, cy)) {
        display.drawLine(px, py, cx, cy);
      }
    }

    prevX = screenX;
    prevY = screenY;
  }
  
  // Draw the fixed rider arrow in the center of the OLED
  display.drawTriangle(
    CENTER_X, CENTER_Y-5,
    CENTER_X-3, CENTER_Y+4,
    CENTER_X+3, CENTER_Y+4
  );
  
  display.sendBuffer();
}

inline bool dimPixel(int i){
  return (i % 2) == 0;   // simple dithering
}


class MyCallbacks: public BLECharacteristicCallbacks {

  void onWrite(BLECharacteristic *pCharacteristic) {

    String value = pCharacteristic->getValue();
    if(value.length() == 0) return;

    String msg = String(value.c_str());

    /* ===== MAP STREAM ===== */

    if(msg == "MAP_START"){
      Serial.println("MAP START");
      mapBuffer = "";
      receivingMap = true;
      return;
    }

    if(msg == "MAP_END"){
      Serial.println("MAP END");
      receivingMap = false;

      Serial.print("MAP SIZE: ");
      Serial.println(mapBuffer.length());
      Serial.print("\nFull MAP: ");
      Serial.println(mapBuffer);
      return;
    }

    if(msg.startsWith("MAP_DATA|") && receivingMap){
      mapBuffer += msg.substring(9);
      Serial.println("MAP CHUNK");
      return;
    }

    /* ===== SECONDARY STREAM ===== */

    if(msg == "SEC_START"){
      Serial.println("SEC START");
      secBuffer = "";
      receivingSec = true;
      originSet = false; 
      targetRiderX = 0.0;
      targetRiderY = 0.0;
      currentRiderX = 0.0;
      currentRiderY = 0.0;
      return;
    }

    if(msg == "SEC_END"){
      Serial.println("SEC END");
      receivingSec = false;

      Serial.print("SEC SIZE: ");
      Serial.println(secBuffer.length());
      Serial.print("\nFull SEC: ");
      Serial.println(secBuffer);

      size_t outLen = 0;

      mbedtls_base64_decode(
        secBinary,
        sizeof(secBinary),
        &outLen,
        (const unsigned char*)secBuffer.c_str(),
        secBuffer.length()
      );

      secBinaryLen = outLen;

      Serial.print("DECODED BYTES: ");
      Serial.println(secBinaryLen);

      // drawSecondaryRoads();
      return;
    }

    if(msg.startsWith("SEC_DATA|") && receivingSec){
      secBuffer += msg.substring(9);
      Serial.println("SEC CHUNK");
      return;
    }

/* ===== POSITION STREAM ===== */
    if (msg.startsWith("POS|")) {
      int splitIndex = msg.indexOf(',');
      if (splitIndex > 0) {
        
        // 1. Extract the raw LIVE Lat and Lon from the phone
        double liveLat = strtod(msg.substring(4, splitIndex).c_str(), NULL);
        double liveLon = strtod(msg.substring(splitIndex + 1).c_str(), NULL);
        
        // 2. Set the Map Origin (Runs only once on the first GPS fix)
        // If your map center isn't exactly where you are standing, 
        // you will need to send these via a separate BLE command instead!
        if (!originSet) {
          originLat = liveLat;
          originLon = liveLon;
          originSet = true;
          Serial.println("MAP ORIGIN SET!");
        }

        // 3. DO THE MATH ON THE ESP32
        // Make sure this scale matches the "0.4" you use in React Native
        double scale = 0.4; 
        double metersPerDegLat = 111320.0;
        double metersPerDegLon = 111320.0 * cos(originLat * PI / 180.0);

        // 4. Calculate distance in meters from the origin
        double dx = (liveLon - originLon) * metersPerDegLon;
        double dy = (liveLat - originLat) * metersPerDegLat;

        // 5. Convert meters to OLED Pixels and update the Lerp target
        targetRiderX = dx * scale;
        targetRiderY = -dy * scale; // Negative because OLED Y-axis goes down

        Serial.print("NEW PIXEL TARGET: ");
        Serial.print(targetRiderX, 4);
        Serial.print(", ");
        Serial.println(targetRiderY, 4);
      }
      return;
    }
  }
};

/*
float heading = 0.0f;   // keep for future rotation

void renderMap(){
  if(secBinaryLen < 2 && mapBinaryLen < 2 ) return;
  const int CENTER_X = 64;
  const int CENTER_Y = 32;

  display.clearBuffer();

  float cosA = cos(-heading);
  float sinA = sin(-heading);

  // =====================================================
  // 1️⃣ SECONDARY ROADS (NORMAL THIN LINES)
  // =====================================================

  int idx = 0;

  if(secBinaryLen >= 2){

    int roadCount = secBinary[idx] | (secBinary[idx+1] << 8);
    idx += 2;

    for(int r=0; r<roadCount; r++){

      if(idx + 1 >= secBinaryLen) break;

      int ptCount = secBinary[idx] | (secBinary[idx+1] << 8);
      idx += 2;

      bool hasPrev = false;
      int lastX=0,lastY=0;

      for(int p=0; p<ptCount; p++){

        if(idx + 1 >= secBinaryLen) break;

        int8_t px = (int8_t)secBinary[idx++];
        int8_t py = (int8_t)secBinary[idx++];

        float rx = px * cosA - py * sinA;
        float ry = px * sinA + py * cosA;

        int sx = CENTER_X + (int)rx;
        int sy = CENTER_Y + (int)ry;

        if(hasPrev){
          display.drawLine(lastX,lastY,sx,sy);
        }

        lastX = sx;
        lastY = sy;
        hasPrev = true;
      }
    }
  }

  // =====================================================
  // 2️⃣ MAIN ROUTE (THICKER LINE)
  // =====================================================

  int midx = 0;

  if(mapBinaryLen >= 2){

    int ptCount = mapBinary[midx] | (mapBinary[midx+1] << 8);
    midx += 2;

    bool hasPrev=false;
    int lastX=0,lastY=0;

    for(int i=0;i<ptCount;i++){

      if(midx + 1 >= mapBinaryLen) break;

      int8_t px = (int8_t)mapBinary[midx++];
      int8_t py = (int8_t)mapBinary[midx++];

      float rx = px * cosA - py * sinA;
      float ry = px * sinA + py * cosA;

      int sx = CENTER_X + (int)rx;
      int sy = CENTER_Y + (int)ry;

      if(hasPrev){

        // draw thicker main route
        display.drawLine(lastX,lastY,sx,sy);
        display.drawLine(lastX+1,lastY,sx+1,sy);
      }

      lastX = sx;
      lastY = sy;
      hasPrev = true;
    }
  }

  // =====================================================
  // 3️⃣ CENTER ARROW
  // =====================================================

  display.drawTriangle(
    CENTER_X, CENTER_Y-5,
    CENTER_X-3, CENTER_Y+4,
    CENTER_X+3, CENTER_Y+4
  );

  display.sendBuffer();
}
*/
void setup() {

  Wire.begin(11,12);   // ESP32 I2C pins
  Wire1.begin(4, 5);
  display.begin();

  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);

  display.drawStr(10, 30, "CONNECT DEVICE");
  display.sendBuffer();

  Serial.begin(115200);
  
  delay(5000);
  MPU9250Setting setting;
  if (!mpu.setup(0x68)) {  
      Serial.println("MPU-9250 connection failed! Restarting...");
      delay(5000);
      //ESP.restart(); // Auto-reboot if it fails to sync
  }
  
  Serial.println("Starting BLE work!");

  BLEDevice::init("MyESP32");  // set the device name
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_WRITE
                                       );

  pCharacteristic->setValue("Hello World!");
  pService->start();
  // BLEAdvertising *pAdvertising = pServer->getAdvertising();  // this still is working for backward compatibility
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // functions that help with iPhone connections issue
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  pCharacteristic->setCallbacks(new MyCallbacks());
  Serial.println("Characteristic defined! Now you can read it in your phone!");
}

void loop() {
  // 1. Update the sensor. This mathematically fuses the 9 axes together.
  // if(mpu.setup(0x68)){
  //   Serial.println("setup successful");
  // }
  // else{
  //   Serial.println("fail");
  // }
  if (mpu.update()) {
    // getYaw() returns the tilt-compensated magnetic heading (0 to 360 degrees)
    // We reverse it (-mpu.getYaw()) because if the bike turns right (positive yaw), 
    // the map needs to rotate left (negative yaw) to stay North-Up.
    heading_degrees = -mpu.getYaw(); 
  }

  // 2. Draw the frame (Limit to ~30 FPS so we don't choke the I2C bus)
  if (!receivingSec && secBinaryLen >= 5) {
    unsigned long currentMillis = millis();
    
    if (currentMillis - lastDrawTime >= 33) {
      lastDrawTime = currentMillis;
      
      // Trigger the OLED render frame with the new heading_degrees
      drawSecondaryRoads();
    }
  }
  // byte error, address;
  // int nDevices = 0;

  // for (address = 1; address < 127; address++) {
  //   Wire1.beginTransmission(address);
  //   error = Wire1.endTransmission();

  //   if (error == 0) {
  //     Serial.print("Device found at 0x");
  //     if (address < 16) Serial.print("0");
  //     Serial.println(address, HEX);
  //     nDevices++;
  //   }
  // }
  // if (nDevices == 0) Serial.println("No I2C devices found\n");
  // else Serial.println("done\n");
  // delay(1000);
}
