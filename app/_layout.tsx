import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import useDeviceStore from "@/stores/deviceStore";
import { disconnectDevice, scanDevices } from "@/utils/ble";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { TouchableOpacity } from "react-native";
import { Device } from "react-native-ble-plx";
import "react-native-reanimated";
import { useShallow } from "zustand/react/shallow";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [device, setDevice] = useDeviceStore(
    useShallow((state) => [state.device, state.setDevice]),
  );

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            headerTitle: "Home",
            headerRight: () => {
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (device) {
                      disconnectDevice(device, setDevice);
                    } else {
                      scanDevices().then((device: Device) => setDevice(device));
                    }
                  }}
                >
                  {!device ? (
                    <IconSymbol
                      size={22}
                      name="link.badge.plus"
                      color={"#007AFF"}
                    />
                  ) : (
                    <IconSymbol size={22} name="link" color={"green"} />
                  )}
                </TouchableOpacity>
              );
            },
          }}
        />
        <Stack.Screen
          name="destination"
          options={{
            headerShown: false,
            headerTitle: "Enter destination",
            presentation: "modal",
            headerLeft: () => {
              return (
                <TouchableOpacity
                  onPress={() => {
                    router.back();
                  }}
                >
                  <ThemedText style={{ color: "#007AFF" }}>Cancel</ThemedText>
                </TouchableOpacity>
              );
            },
          }}
        />
        <Stack.Screen
          name="navigation_action"
          options={{
            headerShown: false,
            headerTitle: "Navigation",
            presentation: "formSheet",
            sheetAllowedDetents: [0.4],
            headerBackButtonMenuEnabled: false,
            headerLeft: () => {
              return (
                <TouchableOpacity
                  onPress={() => {
                    router.back();
                  }}
                >
                  <ThemedText style={{ color: "#007AFF" }}>Back</ThemedText>
                </TouchableOpacity>
              );
            },
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
