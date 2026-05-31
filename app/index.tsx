import RoutePreview from "@/components/RoutePreview";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import useDeviceStore from "@/stores/deviceStore";
import useLocationStore from "@/stores/locationStore";
import { disconnectDevice, scanDevices } from "@/utils/ble";
import { getCurrentLocation } from "@/utils/location";
import {
  BarcodeScanningResult,
  CameraType,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import Constants from "expo-constants";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { BleManager, Device } from "react-native-ble-plx";
import { useShallow } from "zustand/react/shallow";

export default function Index() {
  const colorScheme = useColorScheme();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const destination = useLocationStore((state) => state.destination);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [device, setDevice] = useDeviceStore(
    useShallow((state) => [state.device, state.setDevice]),
  );
  const height = Constants.statusBarHeight || 0;
  const [toggleCamera, setToggleCamera] = useState<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = React.useRef<any>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    getCurrentLocation(setLocation, setErrorMsg).then((sub) => {
      if (sub) subscription = sub;
    });

    return () => {
      subscription?.remove(); // Clean up on unmount
    };
  }, []);

  useEffect(() => {
    let stopListener: any = null;
    if (device) {
      stopListener = new BleManager().onDeviceDisconnected(
        device.id,
        (arg: any) => {
          console.log("device disconnected", arg);
          setDevice(null);
        },
      );
    }

    return () => {
      stopListener?.remove();
    };
  }, [device, setDevice]);

  function toggleCameraFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  let barcode = false; // to prevent multiple scans
  const handleBarcodeScan = (scanningResult: BarcodeScanningResult) => {
    if (barcode) return; // prevent multiple scans
    barcode = true;
    let [serviceUUID, characteristicUUID] = scanningResult.data.split(" ");
    scanDevices(serviceUUID, characteristicUUID).then((device: Device) => {
      barcode = false;
      setDevice(device);
    });
    console.log("Scanned barcode:", scanningResult.data);
    setToggleCamera(false);
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      {toggleCamera ? (
        <View style={style.container}>
          <CameraView
            facing={facing}
            style={style.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcodeScan}
          />
          <View style={style.buttonContainer}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                style.centerButton,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#1f1f1f" : "#e1e1e1",
                },
              ]}
              onPress={toggleCameraFacing}
              accessibilityLabel="Toggle camera"
            >
              <IconSymbol
                color="#007aff"
                size={24}
                name="arrow.trianglehead.2.clockwise.rotate.90.camera"
              />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                style.centerButton,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#1f1f1f" : "#e1e1e1",
                },
              ]}
              onPress={() => setToggleCamera(false)}
              accessibilityLabel="Close camera"
            >
              <IconSymbol color="#007aff" size={24} name="xmark" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={{
              margin: 10,
              position: "absolute",
              left: 0,
              top: height,
              zIndex: 1,
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: colorScheme === "dark" ? "#1f1f1f" : "#e0e0e0",
              paddingVertical: 4,
              paddingHorizontal: 12,
              borderRadius: 100,
              borderWidth: 1,
              borderColor: colorScheme === "dark" ? "#333" : "#c0c0c0",
            }}
            onPress={() => {
              if (device) {
                disconnectDevice(device, setDevice);
              } else {
                setToggleCamera(true);
                // scanDevices().then((device: Device) => setDevice(device));
              }
            }}
          >
            <IconSymbol
              color={device ? "green" : "crimson"}
              name="circle.fill"
              size={12}
            />
            <ThemedText>{device ? "Connected" : "No connection"}</ThemedText>
          </TouchableOpacity>
          {destination && location && (
            <>
              <RoutePreview
                dest={{
                  latitude: destination!.latitude,
                  longitude: destination!.longitude,
                }}
                source={{
                  latitude: location?.coords?.latitude as number,
                  longitude: location?.coords?.longitude as number,
                }}
                connectedDevice={device}
              />
            </>
          )}
        </>
      )}
    </ThemedView>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  message: {
    textAlign: "center",
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 20,
    flexDirection: "row",
    backgroundColor: "transparent",
    width: "100%",
    paddingHorizontal: 14,
    right: 20,
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  button: {
    flex: 1,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0)",
    paddingVertical: 12,
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
  },
  routeBtn: {
    backgroundColor: "#007afa",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 800,
    elevation: 4,
    flex: 1,
  },
  routeBtnText: {
    color: "#e1e1e1",
    fontWeight: "600",
    textAlign: "center",
  },
  centerButton: {
    borderRadius: 8,
    elevation: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 4,
  },
});
