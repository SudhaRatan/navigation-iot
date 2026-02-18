import RoutePreview from "@/components/RoutePreview";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Button } from "react-native";
import {
  GooglePlacesAutocomplete,
  GooglePlacesAutocompleteRef,
} from "react-native-google-places-autocomplete";

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

  async function getCurrentLocation() {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setErrorMsg("Permission to access location was denied");
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    setLocation(location);
    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, distanceInterval: 0.1 },
      (newLocation) => {
        setLocation(newLocation);
      },
      console.warn,
    );
  }

  const enterDestinationPress = () => {
    setShowGoogleAutoComplete(true);
  };

  const sendNavData = () => {
    Alert.alert(
      "Navigation Data Sent",
      JSON.stringify({ location, destination }),
    );
  };

  useEffect(() => {
    if (!apiKey) Alert.alert("Error", "Google API key is missing");
    getCurrentLocation();
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
      <ThemedText>
        {JSON.stringify(
          {
            latitude: location?.coords.latitude,
            longitude: location?.coords.longitude,
          },
          null,
        )}{" "}
        ||
        {JSON.stringify(destination, null)}
      </ThemedText>
      {!showGoogleAutoComplete && (
        <Button
          title="Enter destination"
          color={colorScheme === "dark" ? "#1f1f1f" : "#828282"}
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
          />
          <Button
            title="Start"
            color={colorScheme === "dark" ? "#1f1f1f" : "#828282"}
            onPress={sendNavData}
          />
        </>
      )}
    </ThemedView>
  );
}
