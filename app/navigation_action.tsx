import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNavigation } from "expo-router";
import { useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";

const { width, height } = Dimensions.get("window");

const NavigationAction = () => {
  const navigation = useNavigation();
  const [tab, setTab] = useState<"clock" | "star" | "heart">("clock");
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const colorScheme = useColorScheme();

  return (
    <ThemedView style={{ flex: 1, padding: 10, height }}>
      <View
        style={{
          width: "15%",
          height: 4,
          backgroundColor: "gray",
          alignSelf: "center",
          borderRadius: 5,
          marginBottom: 10,
        }}
      />
      <SegmentedControl
        iconsOnly
        value={tab}
        onChange={setTab}
        activeColor={colorScheme === "dark" ? "#00aFFF" : "#007AFF"}
        backgroundColor={colorScheme === "dark" ? "#313131" : "#ececec"}
        tintColor="white"
        segments={[
          {
            value: "clock",
            icon: <IconSymbol name="car.fill" size={24} color={"white"} />,
          },
          {
            value: "star",
            icon: (
              <IconSymbol name="motorcycle.fill" size={24} color={"white"} />
            ),
          },
          {
            value: "heart",
            icon: <IconSymbol name="figure.walk" size={24} color={"white"} />,
          },
        ]}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({});

export default NavigationAction;
