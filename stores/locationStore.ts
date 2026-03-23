import { create } from "zustand";

type LocationStore = {
  destination: Coords | null;
  setDestination: (location: Coords | null) => void;
};

type Coords = {
  latitude: number;
  longitude: number;
};

const useLocationStore = create<LocationStore>((set, get) => ({
  destination: null,
  setDestination: (destination) => set({ destination }),
}));
export default useLocationStore;
