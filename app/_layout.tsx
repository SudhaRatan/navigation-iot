import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import useDeviceStore from "@/stores/deviceStore";
import { scanDevices } from "@/utils/ble";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
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
            headerShown: true,
            headerTitle: "Home",
            headerRight: () => {
              return (
                <TouchableOpacity
                  onPress={() => {
                    scanDevices().then((device: Device) => setDevice(device));
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
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
