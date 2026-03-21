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

export { getCurrentLocation };
