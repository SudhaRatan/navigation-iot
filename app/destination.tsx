import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol.ios";
import { useColorScheme } from "@/hooks/use-color-scheme.web";
import useLocationStore from "@/stores/locationStore";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
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
  const [destinationText, setDestinationText] = useState<string>("");

  useEffect(() => {
    if (!apiKey) Alert.alert("Error", "Google API key is missing");
    setTimeout(() => {
      GoogleRef.current?.focus();
    }, 100);
    console.log(destination);
  }, [destination]);

  return (
    <ThemedView
      style={{
        flex: 1,
        padding: 10,
      }}
    >
      <View
        style={{
          width: "20%",
          height: 5,
          backgroundColor: "gray",
          alignSelf: "center",
          marginTop: 12,
          marginBottom: 20,
          borderRadius: 5,
        }}
      />
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
        renderLeftButton={() => (
          <IconSymbol
            style={{ marginLeft: 12, alignSelf: "center", marginBottom: 6 }}
            color={colorScheme === "dark" ? "#888" : "#555"}
            size={22}
            name="magnifyingglass"
          />
        )}
        textInputProps={{
          placeholderTextColor: colorScheme === "dark" ? "#888" : "#555",
          onChangeText: (text) => {
            setDestinationText(text);
          },
        }}
        styles={{
          container: { flex: 1 },
          textInputContainer: {
            backgroundColor: colorScheme === "dark" ? "#1f1f1f" : "#f1f1f1",
            color: colorScheme === "dark" ? "white" : "black",
            paddingVertical: 0,
            paddingTop: 6,
            borderRadius: 100,
            alignContent: "center",
            justifyContent: "center",
            marginHorizontal: 10,
            borderWidth: 1,
            borderColor: colorScheme === "dark" ? "#444" : "#ccc",
          },
          description: {
            color: colorScheme === "dark" ? "white" : "black",
          },
          poweredContainer: {
            display: "none",
          },
          textInput: {
            color: colorScheme === "dark" ? "white" : "black",
            backgroundColor: "transparent",
            marginRight: 10,
          },
          listView: {
            backgroundColor: "transparent",
          },
          row: {
            backgroundColor: "transparent",
            color: colorScheme === "dark" ? "white" : "black",
          },
        }}
      />
    </ThemedView>
  );
};

export default Destination;
