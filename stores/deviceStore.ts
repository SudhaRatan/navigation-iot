import { Device } from "react-native-ble-plx";
import { create } from "zustand";

type DeviceStore = {
  device: Device | null;
  setDevice: (device: Device | null) => void;
};

const useDeviceStore = create<DeviceStore>((set, get) => ({
  device: null,
  setDevice: (device) => set({ device: device }),
}));
export default useDeviceStore;
