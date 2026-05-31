import { fromByteArray } from "base64-js";
import * as ExpoDevice from "expo-device";
import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, Device } from "react-native-ble-plx";

let SERVICE_UUID: string = "";
let CHARACTERISTIC_UUID: string = "";

const requestAndroid31Permissions = async () => {
  const bluetoothScanPermission = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    {
      title: "Location Permission",
      message: "Bluetooth Low Energy requires Location",
      buttonPositive: "OK",
    },
  );
  const bluetoothConnectPermission = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    {
      title: "Location Permission",
      message: "Bluetooth Low Energy requires Location",
      buttonPositive: "OK",
    },
  );
  const fineLocationPermission = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: "Location Permission",
      message: "Bluetooth Low Energy requires Location",
      buttonPositive: "OK",
    },
  );
  console.log(
    bluetoothScanPermission === "granted",
    bluetoothConnectPermission === "granted",
    fineLocationPermission === "granted",
  );
  return (
    bluetoothScanPermission === "granted" &&
    bluetoothConnectPermission === "granted" &&
    fineLocationPermission === "granted"
  );
};

const requestPermissions = async () => {
  console.log("Getting permissions");
  if (Platform.OS === "android") {
    if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "Bluetooth Low Energy requires Location",
          buttonPositive: "OK",
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const isAndroid31PermissionsGranted = await requestAndroid31Permissions();

      return isAndroid31PermissionsGranted;
    }
  } else {
    return true;
  }
};

const manager = new BleManager();

async function scanDevices(
  serviceUUID: string,
  characteristicUUID: string,
): Promise<Device> {
  console.log("Scanning devices");
  return new Promise((res, rej) => {
    try {
      let deviceFound = false;
      manager.startDeviceScan(
        null,
        { allowDuplicates: false },
        async (error, device) => {
          if (error) {
            console.log("SCAN ERROR", error);
            return;
          }

          if (deviceFound) return; // prevent multiple discoveries

          if (!device) return;

          if (
            device.name === "MyESP32" ||
            device.serviceUUIDs?.includes(serviceUUID)
          ) {
            console.log("Found device: ", device);
            deviceFound = true;
            stopScan();
            SERVICE_UUID = serviceUUID;
            CHARACTERISTIC_UUID = characteristicUUID;
            res(await connectToDevice(device)); // send device back to UI
          }
        },
      );
    } catch (error) {
      rej(error);
    }
  });
}

function stopScan() {
  manager.stopDeviceScan();
}

/* ================= CONNECT ================= */

async function connectToDevice(device: Device) {
  console.log("Connecting to device: ", device);

  const connectedDevice = await manager.connectToDevice(device.id);

  await connectedDevice.discoverAllServicesAndCharacteristics();
  console.log("Connected");

  return connectedDevice;
}

async function disconnectDevice(
  device: Device,
  setDevice: (device: Device | null) => void,
) {
  if (!device) return;

  try {
    const connected = await manager.isDeviceConnected(device.id);

    if (connected) {
      await manager.cancelDeviceConnection(device.id);
      console.log("DISCONNECTED:", device.id);
    }
  } catch (e) {
    console.log("DISCONNECT ERROR:", e);
  } finally {
    // always clear local state AFTER ble stack settles
    setTimeout(() => setDevice(null), 100);
  }
}

function packRoute(routeCoords: [number, number][]) {
  if (!routeCoords || routeCoords.length === 0) return null;

  const originLon = routeCoords[0][0];
  const originLat = routeCoords[0][1];

  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos((originLat * Math.PI) / 180);

  const scale = 2; // 1 unit = 0.5m

  const arr = [];

  // header (2 bytes) -> point count
  const count = routeCoords.length;
  arr.push(count & 0xff);
  arr.push((count >> 8) & 0xff);

  routeCoords.forEach((pt) => {
    const dx = (pt[0] - originLon) * metersPerDegLon;
    const dy = (pt[1] - originLat) * metersPerDegLat;

    let x = Math.round(dx * scale);
    let y = Math.round(dy * scale);

    if (x > 239) x = 239;
    if (x < -240) x = -240;
    if (y > 239) y = 239;
    if (y < -240) y = -240;

    arr.push(x & 0xff);
    arr.push(y & 0xff);
  });

  return fromByteArray(new Uint8Array(arr));
}

/* ================= SEND ROUTE ================= */

async function writeStreamPackets(
  device: Device,
  prefix: string,
  base64Data: string,
) {
  const CHUNK_SIZE = 160;
  const encoder = new TextEncoder();

  // START
  await device.writeCharacteristicWithResponseForService(
    SERVICE_UUID!,
    CHARACTERISTIC_UUID!,
    fromByteArray(encoder.encode(prefix + "_START")),
  );

  // DATA
  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    const chunk = prefix + "_DATA|" + base64Data.substring(i, i + CHUNK_SIZE);

    await device.writeCharacteristicWithResponseForService(
      SERVICE_UUID!,
      CHARACTERISTIC_UUID!,
      fromByteArray(encoder.encode(chunk)),
    );
  }

  // END
  await device.writeCharacteristicWithResponseForService(
    SERVICE_UUID!,
    CHARACTERISTIC_UUID!,
    fromByteArray(encoder.encode(prefix + "_END")),
  );
}

async function writeCoordsPackets(
  device: Device,
  latitude: number,
  longitude: number,
) {
  const encoder = new TextEncoder();
  await device.writeCharacteristicWithResponseForService(
    SERVICE_UUID!,
    CHARACTERISTIC_UUID!,
    fromByteArray(encoder.encode(`POS|${latitude},${longitude}`)),
  );
}

async function sendRouteToESP(
  connectedDevice: Device,
  routeCoords: [number, number][],
) {
  const payload = packRoute(routeCoords);

  if (!payload || !connectedDevice) return;

  await writeStreamPackets(connectedDevice, "MAP", payload);
}

export {
  connectToDevice,
  disconnectDevice,
  packRoute,
  requestAndroid31Permissions,
  requestPermissions,
  scanDevices,
  sendRouteToESP,
  stopScan,
  writeCoordsPackets,
  writeStreamPackets
};

