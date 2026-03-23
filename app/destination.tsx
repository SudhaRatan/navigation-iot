import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme.web";
import useLocationStore from "@/stores/locationStore";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import {
  GooglePlacesAutocomplete,
  GooglePlacesAutocompleteRef,
} from "react-native-google-places-autocomplete";
import { useShallow } from "zustand/react/shallow";

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

const Destination = () => {
  const colorScheme = useColorScheme();
  const GoogleRef = useRef<GooglePlacesAutocompleteRef>(null);
  const [destination, setDestination] = useLocationStore(
    useShallow((state) => [state.destination, state.setDestination]),
  );

  useEffect(() => {
    if (!apiKey) Alert.alert("Error", "Google API key is missing");
    setTimeout(() => {
      GoogleRef.current?.focus();
    }, 100);
    console.log(destination);
  }, [destination]);

  return (
    <ThemedView style={{ flex: 1, padding: 10 }}>
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
          router.back();
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
    </ThemedView>
  );
};

export default Destination;
