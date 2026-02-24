import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  sendRouteToESP,
  writeCoordsPackets,
  writeStreamPackets,
} from "@/utils/ble";
import {
  Camera,
  CircleLayer,
  LineLayer,
  MapView,
  ShapeSource,
} from "@maplibre/maplibre-react-native";
import { fromByteArray } from "base64-js";
import React, { useEffect, useState } from "react";
import {
  Button,
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Device } from "react-native-ble-plx";

type Props = {
  source: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  connectedDevice: Device | null;
};

export default function RoutePreview({ source, dest, connectedDevice }: Props) {
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState<boolean>(true);
  const [recenterCounter, setRecenterCounter] = useState<number>(0);
  const [secondaryRoadsGeoJSON, setSecondaryRoadsGeoJSON] = useState<any>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function loadRoute() {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${source.lon},${source.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson&alternatives=true`,
      );

      const json = await res.json();

      const features = json.routes.map((route: any, index: number) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: route.geometry.coordinates,
        },
        properties: {
          id: index,
          distance: route.distance,
          duration: route.duration,
        },
      }));

      setRouteGeoJSON({
        type: "FeatureCollection",
        features,
      });

      setSelectedRouteId(0);
      const firstRoute = json.routes?.[0]?.geometry?.coordinates;
      if (firstRoute?.length > 0) {
        await fetchSecondaryRoads(source.lat, source.lon, firstRoute[0]);
      }
    }

    loadRoute();
  }, [dest.lat, dest.lon]);

  function handleSourcePress(e: any) {
    const pressedId =
      e?.features?.[0]?.properties?.id ??
      e?.features?.[0]?.id ??
      e?.nativeEvent?.features?.[0]?.properties?.id ??
      e?.nativeEvent?.payload?.features?.[0]?.properties?.id;

    if (typeof pressedId === "number") setSelectedRouteId(pressedId);
  }

  // Called when user interacts with the map (pans/zooms) to stop following.
  function handleMapTouch(_e: GestureResponderEvent) {
    setIsFollowing(false);
  }

  function handleCenterPress() {
    setIsFollowing(true);
    setRecenterCounter((c) => c + 1);
  }

  function getSelectedRouteCoords() {
    if (!routeGeoJSON) return null;

    const feature = routeGeoJSON.features.find(
      (f: any) => (f.properties?.id ?? f.id) === selectedRouteId,
    );

    return feature?.geometry?.coordinates || null; // <-- THIS is routeCoords
  }

  const start = async () => {
    if (connectedDevice) {
      const routeCoords = getSelectedRouteCoords();
      sendRouteToESP(connectedDevice, routeCoords);

      const roads = getSecondaryRoadCoords();
      const packedRoads = packSecondaryRoads(roads, source.lat, source.lon);
      if (packedRoads && connectedDevice) {
        await writeStreamPackets(connectedDevice, "SEC", packedRoads);
      }
    }
  };

  const coordsChange = async () => {
    // write code to change dest lat lon from buttons and then send the changed data using
    if (connectedDevice) {
      console.log(source);
      await writeCoordsPackets(connectedDevice, source.lat, source.lon);
    }
  };

  async function fetchSecondaryRoads(
    riderLat: number,
    riderLon: number,
    target: [number, number],
  ) {
    // SAME AS HTML RENDER SCALE
    const scale = 0.4;

    const metersPerDegLat = 111320;
    const metersPerDegLon = 111320 * Math.cos((riderLat * Math.PI) / 180);

    // OLED size
    const SCREEN_W = 128;
    const SCREEN_H = 64;

    // we want 3x3 screen area
    const halfW = (SCREEN_W * 3) / 2; // 192
    const halfH = (SCREEN_H * 3) / 2; // 96

    // convert screen pixels → meters
    const maxMetersX = halfW / scale;
    const maxMetersY = halfH / scale;

    // meters → lat/lon delta
    const lonDelta = maxMetersX / metersPerDegLon;
    const latDelta = maxMetersY / metersPerDegLat;

    const minLat = riderLat - latDelta;
    const maxLat = riderLat + latDelta;
    const minLon = riderLon - lonDelta;
    const maxLon = riderLon + lonDelta;

    const query = `
  [out:json];
  way["highway"]
  (${minLat},${minLon},${maxLat},${maxLon});
  out geom;
  `;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });

    const data = await res.json();

    const features = data.elements
      .filter((el: any) => el.geometry)
      .map((el: any) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: el.geometry.map((p: any) => [p.lon, p.lat]),
        },
        properties: {},
      }));

    setSecondaryRoadsGeoJSON({
      type: "FeatureCollection",
      features,
    });
  }

  function getSecondaryRoadCoords() {
    if (!secondaryRoadsGeoJSON) return [];

    return secondaryRoadsGeoJSON.features.map((f: any) => {
      return f.geometry.coordinates; // [[lon,lat]...]
    });
  }

  function packSecondaryRoads(
    roadsRaw: any[],
    originLat: number,
    originLon: number,
  ) {
    if (!roadsRaw || roadsRaw.length === 0) return null;

    const metersPerDegLat = 111320;
    const metersPerDegLon = 111320 * Math.cos((originLat * Math.PI) / 180);
    const scale = 0.4;

    const arr: number[] = [];

    roadsRaw.forEach((road) => {
      road.forEach((pt: any, i: number) => {
        const lon = pt.lon !== undefined ? pt.lon : pt[0];
        const lat = pt.lat !== undefined ? pt.lat : pt[1];

        if (lon === undefined || lat === undefined) return;

        let dx = (lon - originLon) * metersPerDegLon;
        let dy = (lat - originLat) * metersPerDegLat;

        // NO CLAMPING: We calculate the true, absolute map coordinates
        let x = Math.round(dx * scale);
        let y = Math.round(-dy * scale);

        arr.push(i === 0 ? 0 : 1); // 0 = moveTo, 1 = lineTo

        // Push 16-bit X (Little Endian: Least Significant Byte first)
        arr.push(x & 0xff);
        arr.push((x >> 8) & 0xff);

        // Push 16-bit Y (Little Endian)
        arr.push(y & 0xff);
        arr.push((y >> 8) & 0xff);
      });
    });

    return fromByteArray(new Uint8Array(arr));
  }

  const sourcePointGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [source.lon, source.lat] },
      },
    ],
  };

  return (
    <View style={styles.container}>
      <View style={styles.map} onTouchStart={handleMapTouch}>
        <MapView
          style={styles.map}
          mapStyle={
            colorScheme === "dark"
              ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
              : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          }
        >
          {/* Camera will recenter only when `isFollowing` is true.
            Toggling `recenterCounter` as the key forces the Camera to remount
            and animate to the source when user presses the center button. */}
          <Camera
            key={recenterCounter}
            animationMode="easeTo"
            animationDuration={500}
            zoomLevel={15}
            {...(isFollowing
              ? { centerCoordinate: [source.lon, source.lat] }
              : {})}
          />

          {/* Source location marker */}
          <ShapeSource id="sourcePoint" shape={sourcePointGeoJSON}>
            <CircleLayer
              id="sourceCircle"
              sourceID="sourcePoint"
              style={{
                circleRadius: 8,
                circleColor: colorScheme === "dark" ? "#00aFFF" : "#007aff",
                circleStrokeWidth: 2,
                circleStrokeColor: "#ffffff",
              }}
            />
          </ShapeSource>

          {routeGeoJSON && (
            <ShapeSource
              id="routeSource"
              shape={routeGeoJSON}
              onPress={handleSourcePress}
            >
              {routeGeoJSON.features.map((feature: any) => {
                const fid = feature.properties?.id ?? feature.id;
                const color = fid === selectedRouteId ? "#00aFFF" : "#999999";
                return (
                  <LineLayer
                    key={fid}
                    id={`routeLine-${fid}`}
                    sourceID="routeSource"
                    filter={["==", ["get", "id"], fid]}
                    style={{
                      lineColor: color,
                      lineWidth: 4,
                    }}
                  />
                );
              })}
            </ShapeSource>
          )}
        </MapView>
      </View>
      <TouchableOpacity
        style={[
          styles.centerButton,
          { backgroundColor: colorScheme === "dark" ? "#0a84ff" : "#007aff" },
        ]}
        onPress={handleCenterPress}
        accessibilityLabel="Center map on current location"
      >
        <Text style={styles.centerButtonText}>Center</Text>
      </TouchableOpacity>
      <Button
        title="Start"
        color={colorScheme === "dark" ? "#1f1f1f" : "#828282"}
        onPress={start}
      />
      <Button
        title="Send change"
        color={colorScheme === "dark" ? "#1f1f1f" : "#828282"}
        onPress={coordsChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centerButton: {
    position: "absolute",
    right: 16,
    bottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    elevation: 4,
  },
  centerButtonText: {
    color: "white",
    fontWeight: "600",
  },
});
