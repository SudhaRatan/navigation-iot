import { create } from "zustand";

type LocationStore = {
  destination: Coords | null;
  setDestination: (location: Coords | null) => void;
};

export type Coords = {
  latitude: number | null;
  longitude: number | null;
};

const useLocationStore = create<LocationStore>((set, get) => ({
  destination: { latitude: null, longitude: null } as Coords,
  setDestination: (destination) => set({ destination }),
}));
export default useLocationStore;
