import RoutePreview from "@/components/RoutePreview";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import useDeviceStore from "@/stores/deviceStore";
import { getCurrentLocation } from "@/utils/location";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Platform } from "react-native";
import {
  GooglePlacesAutocomplete,
  GooglePlacesAutocompleteRef,
} from "react-native-google-places-autocomplete";
import { useShallow } from "zustand/react/shallow";

type Coords = {
  latitude: number;
  longitude: number;
};

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

export default function Index() {
  const colorScheme = useColorScheme();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [destination, setDestination] = useState<Coords | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const GoogleRef = useRef<GooglePlacesAutocompleteRef>(null);
  const [showGoogleAutoComplete, setShowGoogleAutoComplete] = useState(false);
  const [device, setDevice] = useDeviceStore(
    useShallow((state) => [state.device, state.setDevice]),
  );

  const enterDestinationPress = () => {
    setShowGoogleAutoComplete(true);
  };

  useEffect(() => {
    if (!apiKey) Alert.alert("Error", "Google API key is missing");
    let subscription: Location.LocationSubscription | null = null;

    getCurrentLocation(setLocation, setErrorMsg).then((sub) => {
      if (sub) subscription = sub;
    });

    return () => {
      subscription?.remove(); // Clean up on unmount
    };
  }, []);

  useEffect(() => {
    if (showGoogleAutoComplete) {
      setTimeout(() => {
        GoogleRef.current?.focus();
      }, 100);
    }
  }, [showGoogleAutoComplete]);

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
      {!showGoogleAutoComplete && (
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
      )}
      {showGoogleAutoComplete && (
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
      )}
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
    </ThemedView>
  );
}
