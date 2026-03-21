import { Device } from "react-native-ble-plx";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type LocationStore = {
  location: Device | null;
  setLocation: (location: Device | null) => void;
};

const useLocationStore = create(
  persist<LocationStore>(
    (set, get) => ({
      location: null,
      setLocation: (location) => set({ location: location }),
    }),
    {
      name: "location-storage",
    },
  ),
);
export default useLocationStore;
