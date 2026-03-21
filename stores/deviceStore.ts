import { Device } from "react-native-ble-plx";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type DeviceStore = {
  device: Device | null;
  setDevice: (device: Device | null) => void;
};

const useDeviceStore = create(
  persist<DeviceStore>(
    (set, get) => ({
      device: null,
      setDevice: (device) => set({ device: device }),
    }),
    {
      name: "device-storage",
    },
  ),
);
export default useDeviceStore;
