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

/**
 * Instead of keeping/dropping entire roads, this trims each road to only
 * the contiguous segments where every point is within thresholdMeters
 * of the main route. Long roads that pass near the route but extend far
 * away are cut — only the junction portion is kept.
 */
function trimRoadsToRoute(
  roads: any[],
  mainRouteCoords: [number, number][],
  thresholdMeters = 100,
): any[] {
  if (!mainRouteCoords || mainRouteCoords.length < 2) return roads;

  const result: any[] = [];

  for (const road of roads) {
    const coords: [number, number][] = road.geometry.coordinates;

    // Mark each point as near (true) or far (false)
    const near = coords.map(([lon, lat]) => {
      const d = minDistToPolyline(lon, lat, mainRouteCoords);
      return d <= thresholdMeters;
    });

    // Split into contiguous runs of near=true points
    let i = 0;
    while (i < coords.length) {
      // Skip far points
      if (!near[i]) {
        i++;
        continue;
      }

      // Collect a contiguous run of near points
      const segment: [number, number][] = [];
      while (i < coords.length && near[i]) {
        segment.push(coords[i]);
        i++;
      }

      // Need at least 2 points to draw a line
      if (segment.length >= 2) {
        result.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: segment },
          properties: {},
        });
      }
    }
  }

  return result;
}

function highwayToWidth(highway: string): number {
  // console.log(highway);
  switch (highway) {
    case "motorway":
    case "trunk":
      return 6;
    case "primary":
      return 6;
    case "secondary":
      return 4;
    case "tertiary":
      return 4;
    case "residential":
    case "unclassified":
      return 6;
    case "service":
    case "footway":
    case "path":
      return 2;
    default:
      return 4;
  }
}

export {
  filterRoadsNearRoute,
  getCurrentLocation,
  haversineMeters,
  highwayToWidth,
  minDistToPolyline,
  trimRoadsToRoute
};

