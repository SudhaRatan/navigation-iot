import * as Location from "expo-location";

async function getCurrentLocation(
  setLocation: React.Dispatch<
    React.SetStateAction<Location.LocationObject | null>
  >,
  setErrorMsg: React.Dispatch<React.SetStateAction<string | null>>,
) {
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    setErrorMsg("Permission to access location was denied");
    return;
  }

  let location = await Location.getCurrentPositionAsync({});
  setLocation(location);

  let subscription: Location.LocationSubscription | null = null;

  const startWatcher = async () => {
    subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, distanceInterval: 0.1 },
      (newLocation) => {
        console.log(
          "watcher fired:",
          newLocation.coords.latitude,
          newLocation.coords.longitude,
        );
        setLocation(newLocation);
      },
      (error) => {
        console.warn("watcher error, restarting:", error);
        subscription?.remove();
        setTimeout(startWatcher, 10); // restart after 10ms
      },
    );
  };

  await startWatcher();

  return {
    remove: () => subscription?.remove(),
  };
}

/**
 * Haversine distance in meters between two [lon, lat] points.
 */
function haversineMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns the minimum distance in meters from point (pLon, pLat)
 * to any segment of the polyline defined by `coords` ([lon,lat][]).
 */
function minDistToPolyline(
  pLon: number,
  pLat: number,
  coords: [number, number][],
): number {
  let minDist = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];

    // Project point onto segment, clamp to [0,1]
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((pLon - x1) * dx + (pLat - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestLon = x1 + t * dx;
    const closestLat = y1 + t * dy;
    const d = haversineMeters(pLon, pLat, closestLon, closestLat);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Filters secondary road features, keeping only roads where at least
 * one point is within `thresholdMeters` of the main route polyline.
 *
 * thresholdMeters ≈ 80m keeps only roads that visually branch off the route.
 */
function filterRoadsNearRoute(
  roads: GeoJSON.Feature[],
  mainRouteCoords: [number, number][], // [lon, lat][]
  thresholdMeters = 80,
): GeoJSON.Feature[] {
  if (!mainRouteCoords || mainRouteCoords.length < 2) return roads;

  return roads.filter((road: any) => {
    const coords: [number, number][] = road.geometry.coordinates;
    // A road is "adjacent" if ANY of its points is close enough
    return coords.some(([lon, lat]) => {
      const d = minDistToPolyline(lon, lat, mainRouteCoords);
      return d <= thresholdMeters;
    });
  });
}

export {
  filterRoadsNearRoute,
  getCurrentLocation,
  haversineMeters,
  minDistToPolyline
};

