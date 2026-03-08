#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_HMC5883_U.h>

#define SDA_PIN 11
#define SCL_PIN 12

Adafruit_HMC5883_Unified mag = Adafruit_HMC5883_Unified(12345);

void setup() {
  Serial.begin(115200);

  Wire.begin(SDA_PIN, SCL_PIN);   // IMPORTANT for ESP32

  if(!mag.begin())
  {
    Serial.println("HMC5883 not detected");
    while(1);
  }

  Serial.println("HMC5883 detected");
}

void loop() {

  sensors_event_t event;
  mag.getEvent(&event);
	float heading = atan2(event.magnetic.y, event.magnetic.x);

	if(heading < 0)
		heading += 2 * PI;

	float headingDegrees = heading * 180/M_PI;

	Serial.print("Heading: ");
	Serial.println(headingDegrees);
	
  Serial.print("X: ");
  Serial.print(event.magnetic.x);
  Serial.print("  Y: ");
  Serial.print(event.magnetic.y);
  Serial.print("  Z: ");
  Serial.println(event.magnetic.z);

  delay(500);
}