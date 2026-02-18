import * as ExpoDevice from "expo-device";
import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, Device } from "react-native-ble-plx";

const SERVICE_UUID = process.env.EXPO_PUBLIC_Service_UUID;

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

async function scanDevices(): Promise<Device> {
  console.log("Scanning devices");
  return new Promise((res, rej) => {
    try {
      manager.startDeviceScan(null, null, async (error, device) => {
        if (error) {
          console.log("SCAN ERROR", error);
          return;
        }

        if (!device) return;

        if (
          device.name === "MyESP32" ||
          device.serviceUUIDs?.includes(SERVICE_UUID!)
        ) {
          console.log("Found device: ", device);
          stopScan();
          res(await connectToDevice(device)); // send device back to UI
        }
      });
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
    await manager.cancelDeviceConnection(device.id);
    console.log("DISCONNECTED:", device.id);
    setDevice(null);
  } catch (e) {
    console.log("DISCONNECT ERROR:", e);
  }
}

export {
  connectToDevice,
  disconnectDevice,
  requestAndroid31Permissions,
  requestPermissions,
  scanDevices,
  stopScan
};

