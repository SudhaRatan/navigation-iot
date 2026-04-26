import { create } from "zustand";

type LocationStore = {
  destination: Coords | null;
  setDestination: (location: Coords | null) => void;
  routeGeoJSON: any | null;
  setRouteGeoJSON: (geojson: any | null) => void;
  description: string | null;
  setDescription: (description: string | null) => void;
};

export type Coords = {
  latitude: number | null;
  longitude: number | null;
};

const useLocationStore = create<LocationStore>((set, get) => ({
  destination: { latitude: null, longitude: null } as Coords,
  setDestination: (destination) => set({ destination }),
  routeGeoJSON: null,
  setRouteGeoJSON: (routeGeoJSON) => set({ routeGeoJSON }),
  description: null,
  setDescription: (description) => set({ description }),
}));
export default useLocationStore;
