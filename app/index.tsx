import RoutePreview from "@/components/RoutePreview";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import useDeviceStore from "@/stores/deviceStore";
import useLocationStore from "@/stores/locationStore";
import { getCurrentLocation } from "@/utils/location";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Button, Platform } from "react-native";
import { useShallow } from "zustand/react/shallow";

export default function Index() {
  const colorScheme = useColorScheme();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [destination, setDestination] = useLocationStore(
    useShallow((state) => [state.destination, state.setDestination]),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showGoogleAutoComplete, setShowGoogleAutoComplete] = useState(false);
  const [device, setDevice] = useDeviceStore(
    useShallow((state) => [state.device, state.setDevice]),
  );

  const enterDestinationPress = () => {
    // setShowGoogleAutoComplete(true);
    router.navigate("/destination");
  };

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
    <ThemedView style={{ flex: 1, padding: 10 }}>
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
      {destination && location && !showGoogleAutoComplete && (
        <>
          <RoutePreview
            dest={{ lat: destination!.latitude, lon: destination!.longitude }}
            source={{
              lat: location!.coords.latitude,
              lon: location!.coords.longitude,
            }}
            connectedDevice={device}
          />
        </>
      )}
      <Button
        title="Enter destination"
        color={
          Platform.OS === "android"
            ? colorScheme === "dark"
              ? "#1f1f1f"
              : "#828282"
            : undefined
        }
        onPress={enterDestinationPress}
      />
      {/* {showGoogleAutoComplete && (
        <GooglePlacesAutocomplete
          ref={GoogleRef}
          placeholder="Enter destination"
          fetchDetails={true}
          query={{
            key: apiKey,
            language: "en",
          }}
          debounce={300}
          onPress={(data, details) => {
            const lat = details?.geometry.location.lat;
            const lng = details?.geometry.location.lng;
            if (lat && lng) setDestination({ latitude: lat, longitude: lng });
            setShowGoogleAutoComplete(false);
          }}
          styles={{
            textInput: {
              backgroundColor: "transparent",
              color: colorScheme === "dark" ? "white" : "black",
            },
            listView: {
              backgroundColor: "transparent",
              color: colorScheme === "dark" ? "white" : "black",
            },
            container: { flex: 1 },
          }}
        />
      )} */}
    </ThemedView>
  );
}
