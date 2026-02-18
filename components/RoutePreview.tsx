import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  Camera,
  CircleLayer,
  LineLayer,
  MapView,
  ShapeSource,
} from "@maplibre/maplibre-react-native";
import React, { useEffect, useState } from "react";
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  source: { lat: number; lon: number };
  dest: { lat: number; lon: number };
};

export default function RoutePreview({ source, dest }: Props) {
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState<boolean>(true);
  const [recenterCounter, setRecenterCounter] = useState<number>(0);
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
