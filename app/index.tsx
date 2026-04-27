import RoutePreview from "@/components/RoutePreview";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import useDeviceStore from "@/stores/deviceStore";
import useLocationStore from "@/stores/locationStore";
import { disconnectDevice, scanDevices } from "@/utils/ble";
import { getCurrentLocation } from "@/utils/location";
import Constants from "expo-constants";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { TouchableOpacity } from "react-native";
import { Device } from "react-native-ble-plx";
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

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    getCurrentLocation(setLocation, setErrorMsg).then((sub) => {
      if (sub) subscription = sub;
    });

    return () => {
      subscription?.remove(); // Clean up on unmount
    };
  }, []);

  return (
    <ThemedView style={{ flex: 1 }}>
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
            scanDevices().then((device: Device) => setDevice(device));
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
      {/* <ThemedText>
        {JSON.stringify(
          {
            latitude: location?.coords.latitude,
            longitude: location?.coords.longitude,
          },
          null,
        )}
        {"\n\n"}
        ||
        {JSON.stringify(destination, null)} {"\n\n"} ||
        {device && JSON.stringify(device, null)}
      </ThemedText> */}
      {/* {device ? (
        <Button
          title="Disconnect"
          color={
            Platform.OS === "android"
              ? colorScheme === "dark"
                ? "#1f1f1f"
                : "#828282"
              : undefined
          }
          onPress={() => disconnectDevice(device, setDevice)}
        />
      ) : (
        <Button
          title="Connect"
          color={
            Platform.OS === "android"
              ? colorScheme === "dark"
                ? "#1f1f1f"
                : "#828282"
              : undefined
          }
          onPress={() =>
            scanDevices().then((device: Device) => setDevice(device))
          }
        />
      )} */}
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
    </ThemedView>
  );
}
