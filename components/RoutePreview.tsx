import { useColorScheme } from "@/hooks/use-color-scheme";
import useLocationStore, { Coords } from "@/stores/locationStore";
import { writeCoordsPackets, writeStreamPackets } from "@/utils/ble";
import {
  Camera,
  CircleLayer,
  LineLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import { fromByteArray } from "base64-js";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ColorSchemeName,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from "react-native";
import { Device } from "react-native-ble-plx";
import { useShallow } from "zustand/react/shallow";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { IconSymbol } from "./ui/icon-symbol.ios";
import { SegmentedControl } from "./ui/SegmentedControl";

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_MapsApiKey;

type TravelMode = "DRIVE" | "TWO_WHEELER" | "BICYCLE" | "WALK";

type RouteModifiers = {
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
};

type Props = {
  source: Coords;
  dest: Coords;
  connectedDevice: Device | null;
};

function decodePolyline(encoded: string): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lng / 1e5, lat / 1e5]);
  }

  return coordinates;
}

export default function RoutePreview({ source, dest, connectedDevice }: Props) {
  const [routeGeoJSON, setRouteGeoJSON, description, setDescription] =
    useLocationStore(
      useShallow((state) => [
        state.routeGeoJSON,
        state.setRouteGeoJSON,
        state.description,
        state.setDescription,
      ]),
    );

  const [selectedRouteId, setSelectedRouteId] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState<boolean>(true);
  const [secondaryRoadsGeoJSON, setSecondaryRoadsGeoJSON] = useState<any>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("DRIVE");
  const [routeModifiers, setRouteModifiers] = useState<RouteModifiers>({
    avoidTolls: false,
    avoidHighways: false,
    avoidFerries: false,
  });
  const [showMore, setShowMore] = useState<boolean>(true);

  const colorScheme = useColorScheme();
  const style = styles({ colorScheme });

  async function loadRoute(
    mode: TravelMode = travelMode,
    modifiers: RouteModifiers = routeModifiers,
  ) {
    try {
      const res = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_API_KEY,
            "X-Goog-FieldMask":
              "routes.polyline,routes.duration,routes.distanceMeters,routes.description",
          } as HeadersInit,
          body: JSON.stringify({
            origin: {
              location: {
                latLng: {
                  latitude: source.latitude,
                  longitude: source.longitude,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: dest.latitude,
                  longitude: dest.longitude,
                },
              },
            },
            travelMode: mode,
            ...(mode === "DRIVE" || mode === "TWO_WHEELER"
              ? {
                  routingPreference: "TRAFFIC_AWARE",
                  computeAlternativeRoutes: true,
                }
              : { computeAlternativeRoutes: false }),
            routeModifiers:
              mode === "DRIVE" || mode === "TWO_WHEELER"
                ? {
                    avoidTolls: modifiers.avoidTolls,
                    avoidHighways: modifiers.avoidHighways,
                    avoidFerries: modifiers.avoidFerries,
                  }
                : {},
          }),
        },
      );

      const json = await res.json();

      if (!json.routes || json.routes.length === 0) {
        console.warn("Google Routes API: no routes found", json);
        return;
      }

      const features = json.routes.map((route: any, index: number) => {
        const coords = decodePolyline(route.polyline.encodedPolyline);
        return {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
          properties: {
            id: index,
            duration: parseFloat(route.duration?.replace("s", "") ?? "0"),
            distance: route.distanceMeters ?? 0,
          },
        };
      });

      setRouteGeoJSON({ type: "FeatureCollection", features });
      setSelectedRouteId(0);

      const firstCoords = features[0]?.geometry?.coordinates;
      if (firstCoords?.length > 0 && source.latitude && source.longitude) {
        await fetchSecondaryRoads(
          source.latitude,
          source.longitude,
          firstCoords[0],
        );
      }
    } catch (error) {
      console.error("loadRoute error:", error);
    }
  }

  function toggleModifier(key: keyof RouteModifiers) {
    setRouteModifiers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      loadRoute(travelMode, next);
      return next;
    });
  }

  function handleSourcePress(e: any) {
    const pressedId =
      e?.features?.[0]?.properties?.id ??
      e?.features?.[0]?.id ??
      e?.nativeEvent?.features?.[0]?.properties?.id ??
      e?.nativeEvent?.payload?.features?.[0]?.properties?.id;

    if (typeof pressedId === "number") setSelectedRouteId(pressedId);
  }

  function handleMapTouch(_e: GestureResponderEvent) {
    setIsFollowing(false);
  }

  function handleCenterPress() {
    if (source.latitude && source.longitude) {
      setIsFollowing(true);
    }
  }

  const enterDestinationPress = () => {
    setDescription(null);
    router.navigate("/destination");
  };

  function packMainRoute(
    routeCoords: any[],
    originLat: number,
    originLon: number,
  ) {
    if (!routeCoords || routeCoords.length === 0) return null;

    const metersPerDegLat = 111320;
    const metersPerDegLon = 111320 * Math.cos((originLat * Math.PI) / 180);
    const scale = 0.4;
    const arr: number[] = [];

    routeCoords.forEach((pt: any, i: number) => {
      const lon = pt[0];
      const lat = pt[1];

      const dx = (lon - originLon) * metersPerDegLon;
      const dy = (lat - originLat) * metersPerDegLat;

      const x = Math.round(dx * scale);
      const y = Math.round(-dy * scale);

      arr.push(i === 0 ? 0 : 1);
      arr.push(x & 0xff);
      arr.push((x >> 8) & 0xff);
      arr.push(y & 0xff);
      arr.push((y >> 8) & 0xff);
    });

    return fromByteArray(new Uint8Array(arr));
  }

  function getSelectedRouteCoords() {
    if (!routeGeoJSON) return null;
    const feature = routeGeoJSON.features.find(
      (f: any) => (f.properties?.id ?? f.id) === selectedRouteId,
    );
    return feature?.geometry?.coordinates || null;
  }

  const start = async () => {
    if (connectedDevice && source.latitude && source.longitude) {
      const routeCoords = getSelectedRouteCoords();
      const packedMain = packMainRoute(
        routeCoords,
        source.latitude,
        source.longitude,
      );
      if (packedMain) {
        await writeStreamPackets(connectedDevice, "MAP", packedMain);
      }

      const roads = getSecondaryRoadCoords();
      const packedRoads = packSecondaryRoads(
        roads,
        source.latitude,
        source.longitude,
      );
      if (packedRoads && connectedDevice) {
        await writeStreamPackets(connectedDevice, "SEC", packedRoads);
      }
    }
  };

  const coordsChange = async () => {
    if (connectedDevice && source.latitude && source.longitude) {
      await writeCoordsPackets(
        connectedDevice,
        source.latitude,
        source.longitude,
      );
    }
  };

  async function fetchSecondaryRoads(
    riderLat: number,
    riderLon: number,
    target: [number, number],
  ) {
    const scale = 0.4;
    const metersPerDegLat = 111320;
    const metersPerDegLon = 111320 * Math.cos((riderLat * Math.PI) / 180);

    const SCREEN_W = 240;
    const SCREEN_H = 240;
    const halfW = (SCREEN_W * 3) / 2;
    const halfH = (SCREEN_H * 3) / 2;

    const maxMetersX = halfW / scale;
    const maxMetersY = halfH / scale;
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

    try {
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

      setSecondaryRoadsGeoJSON({ type: "FeatureCollection", features });
    } catch (error) {
      console.log("Error fetching secondary roads:", error);
    }
  }

  function getSecondaryRoadCoords() {
    if (!secondaryRoadsGeoJSON) return [];
    return secondaryRoadsGeoJSON.features.map(
      (f: any) => f.geometry.coordinates,
    );
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

        const dx = (lon - originLon) * metersPerDegLon;
        const dy = (lat - originLat) * metersPerDegLat;
        const x = Math.round(dx * scale);
        const y = Math.round(-dy * scale);

        arr.push(i === 0 ? 0 : 1);
        arr.push(x & 0xff);
        arr.push((x >> 8) & 0xff);
        arr.push(y & 0xff);
        arr.push((y >> 8) & 0xff);
      });
    });

    return fromByteArray(new Uint8Array(arr));
  }

  useEffect(() => {
    if (dest.latitude && dest.longitude) {
      loadRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest.latitude, dest.longitude]);

  useEffect(() => {
    if (connectedDevice && source.latitude && source.longitude) coordsChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.latitude, source.longitude]);

  useEffect(() => {
    if (dest.latitude && dest.longitude) {
      loadRoute(travelMode, routeModifiers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelMode]);

  const sourcePointGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [source.longitude as number, source.latitude as number],
        },
      },
    ],
  };

  const destPointGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [dest.longitude as number, dest.latitude as number],
        },
      },
    ],
  };

  const TRAVEL_MODES: { value: TravelMode; sfSymbol: string; label: string }[] =
    [
      { value: "DRIVE", sfSymbol: "car.fill", label: "Car" },
      { value: "TWO_WHEELER", sfSymbol: "motorcycle.fill", label: "Moto" },
      // { value: "BICYCLE", sfSymbol: "bicycle", label: "Bike" },
      { value: "WALK", sfSymbol: "figure.walk", label: "Walk" },
    ];

  // Derive selected route's ETA and distance for display below segment control
  const selectedRouteFeature = routeGeoJSON?.features?.find(
    (f: any) => (f.properties?.id ?? f.id) === selectedRouteId,
  );
  const selectedMins = selectedRouteFeature
    ? Math.round(selectedRouteFeature.properties.duration / 60)
    : null;
  const selectedKm = selectedRouteFeature
    ? (selectedRouteFeature.properties.distance / 1000).toFixed(1)
    : null;

  return (
    <ThemedView style={style.container}>
      <View style={style.map} onTouchStart={handleMapTouch}>
        <MapView
          style={style.map}
          mapStyle={
            colorScheme === "dark"
              ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
              : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          }
        >
          <Camera
            animationMode="easeTo"
            animationDuration={500}
            zoomLevel={15}
            {...(isFollowing && source.latitude && source.longitude
              ? { centerCoordinate: [source.longitude, source.latitude] }
              : {})}
          />

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

          <ShapeSource id="destPoint" shape={destPointGeoJSON}>
            <SymbolLayer
              id="destSymbol"
              sourceID="destPoint"
              style={{
                iconImage:
                  "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png",
                iconSize: 0.75,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
          </ShapeSource>

          {routeGeoJSON && (
            <ShapeSource
              id="routeSource"
              shape={routeGeoJSON}
              onPress={handleSourcePress}
            >
              <LineLayer
                id="routeLine-0"
                sourceID="routeSource"
                filter={[
                  "all",
                  ["==", ["get", "id"], 0],
                  ["!=", ["get", "id"], selectedRouteId],
                ]}
                style={{ lineColor: "#999999", lineWidth: 4 }}
              />
              <LineLayer
                id="routeLine-1"
                sourceID="routeSource"
                filter={[
                  "all",
                  ["==", ["get", "id"], 1],
                  ["!=", ["get", "id"], selectedRouteId],
                ]}
                style={{ lineColor: "#999999", lineWidth: 4 }}
              />
              <LineLayer
                id="routeLine-2"
                sourceID="routeSource"
                filter={[
                  "all",
                  ["==", ["get", "id"], 2],
                  ["!=", ["get", "id"], selectedRouteId],
                ]}
                style={{ lineColor: "#999999", lineWidth: 4 }}
              />
              <LineLayer
                id="routeLine-selected"
                sourceID="routeSource"
                filter={["==", ["get", "id"], selectedRouteId]}
                style={{ lineColor: "#00aFFF", lineWidth: 5 }}
              />
            </ShapeSource>
          )}
        </MapView>

        <View style={style.actionContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              style.centerButton,
              {
                backgroundColor: colorScheme === "dark" ? "#1f1f1f" : "#e1e1e1",
              },
            ]}
            onPress={handleCenterPress}
            accessibilityLabel="Center map on current location"
          >
            <IconSymbol color="#007aff" size={24} name="location" />
          </TouchableOpacity>

          <ThemedView
            style={{
              flex: 1,
              alignItems: "flex-start",
              flexDirection: "column",
              width: "100%",
              padding: 12,
              paddingBottom: 24,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              gap: 20,
              paddingTop: 30,
            }}
          >
            {/* Drag handle */}
            {description && (
              <Pressable
                onPress={() => {
                  setShowMore(!showMore);
                }}
                style={{
                  alignSelf: "center",
                  width: "100%",
                  alignItems: "center",
                  position: "absolute",
                  top: 4,
                }}
              >
                <IconSymbol
                  name={
                    !showMore ? "chevron.compact.up" : "chevron.compact.down"
                  }
                  size={24}
                  color="#fff"
                />
              </Pressable>
            )}

            {/* Destination search bar */}
            <TouchableHighlight
              style={style.destinationBtn}
              onPress={enterDestinationPress}
              underlayColor={colorScheme === "dark" ? "#1e1e1e" : "#e2e2e2"}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  overflow: "hidden",
                  paddingRight: 4,
                }}
              >
                <IconSymbol color="#007aff" size={22} name="magnifyingglass" />
                <Text numberOfLines={1} style={{ color: "#818181" }}>
                  {description || "Enter destination"}
                </Text>
              </View>
            </TouchableHighlight>

            {description && routeGeoJSON && (
              <>
                {showMore ? (
                  <>
                    {/* Travel mode selector */}
                    <SegmentedControl
                      iconsOnly
                      value={travelMode}
                      onChange={(val) => setTravelMode(val as TravelMode)}
                      activeColor={colorScheme !== "dark" ? "#fff" : "#151718"}
                      backgroundColor={
                        colorScheme === "dark" ? "#313131" : "#ececec"
                      }
                      tintColor={"#007afa"}
                      segments={TRAVEL_MODES.map((m) => ({
                        value: m.value,
                        icon: (
                          <IconSymbol
                            name={m.sfSymbol as any}
                            size={20}
                            color={
                              travelMode === m.value
                                ? colorScheme !== "dark"
                                  ? "#151718"
                                  : "#fff"
                                : "#818181"
                            }
                          />
                        ),
                      }))}
                    />

                    {/* Avoid toggles */}
                    {travelMode === "DRIVE" || travelMode === "TWO_WHEELER" ? (
                      <View style={style.avoidRow}>
                        {(
                          [
                            { key: "avoidTolls", label: "Tolls" },
                            { key: "avoidHighways", label: "Highways" },
                            { key: "avoidFerries", label: "Ferries" },
                          ] as { key: keyof RouteModifiers; label: string }[]
                        ).map(({ key, label }) => (
                          <TouchableOpacity
                            key={key}
                            onPress={() => toggleModifier(key)}
                            style={[
                              style.avoidBtn,
                              {
                                backgroundColor: routeModifiers[key]
                                  ? colorScheme === "dark"
                                    ? "#000"
                                    : "#fff"
                                  : colorScheme === "dark"
                                    ? "#313131"
                                    : "#ececec",
                              },
                            ]}
                          >
                            <IconSymbol
                              color="#007afa"
                              name={routeModifiers[key] ? "xmark" : "checkmark"}
                              size={12}
                            />
                            <Text style={[style.avoidLabel, { color: "#fff" }]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <></>
                    )}

                    {/* Route selector (labels only, no eta/distance in segments) */}
                    {routeGeoJSON.features.length > 1 && (
                      <SegmentedControl
                        labelsOnly
                        value={selectedRouteId}
                        onChange={(val) => setSelectedRouteId(val)}
                        activeColor={
                          colorScheme !== "dark" ? "#fff" : "#151718"
                        }
                        backgroundColor={
                          colorScheme === "dark" ? "#313131" : "#ececec"
                        }
                        tintColor={"#007afa"}
                        segments={routeGeoJSON.features.map((f: any) => {
                          const id = f.properties?.id ?? f.id ?? 0;
                          return {
                            value: id,
                            label: `Route ${id + 1}`,
                          };
                        })}
                      />
                    )}
                  </>
                ) : (
                  <></>
                )}

                {/* ETA and distance for the selected route */}
                {selectedMins !== null && selectedKm !== null && (
                  <View style={style.etaRow}>
                    <View style={style.etaItem}>
                      <Text style={style.etaValue}>{selectedMins} min</Text>
                      <Text style={style.etaLabel}>ETA</Text>
                    </View>
                    <View style={style.etaDivider} />
                    <View style={style.etaItem}>
                      <Text style={style.etaValue}>{selectedKm} km</Text>
                      <Text style={style.etaLabel}>Distance</Text>
                    </View>
                  </View>
                )}

                {/* Start button */}
                <Pressable style={style.routeBtn} onPress={start}>
                  <ThemedText style={style.routeBtnText}>
                    Start navigation
                  </ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = ({ colorScheme }: { colorScheme: ColorSchemeName }) =>
  StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1, overflow: "hidden" },
    centerButton: {
      borderRadius: 8,
      elevation: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      margin: 12,
    },
    actionContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      justifyContent: "center",
      alignItems: "flex-end",
      width: "100%",
    },
    destinationBtn: {
      backgroundColor: colorScheme === "dark" ? "#1f1f1f" : "#e1e1e1",
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 8,
      width: "100%",
      elevation: 4,
      borderWidth: 1,
      borderColor: colorScheme === "dark" ? "#1a1a1a" : "#c1c1c1",
    },

    avoidRow: {
      flexDirection: "row",
      gap: 8,
      width: "100%",
    },
    avoidBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 4,
    },
    avoidLabel: {
      fontSize: 11,
      fontWeight: "600",
    },
    etaRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      paddingHorizontal: 4,
      gap: 16,
    },
    etaItem: {
      alignItems: "flex-start",
      gap: 2,
    },
    etaValue: {
      fontSize: 20,
      fontWeight: "700",
      color: colorScheme === "dark" ? "#ffffff" : "#111111",
    },
    etaLabel: {
      fontSize: 12,
      color: "#818181",
    },
    etaDivider: {
      width: 1,
      height: 32,
      backgroundColor: colorScheme === "dark" ? "#444" : "#ddd",
    },
    routeBtn: {
      backgroundColor: "#007afa",
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 800,
      width: "100%",
      elevation: 4,
    },
    routeBtnText: {
      color: "#e1e1e1",
      fontWeight: "600",
      textAlign: "center",
    },
  });
