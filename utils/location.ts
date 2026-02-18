import * as Location from "expo-location";

async function getCurrentLocation(
  setLocation: React.Dispatch<
    React.SetStateAction<Location.LocationObject | null>
  >,
  setErrorMsg: React.Dispatch<React.SetStateAction<string | null>>,
) {
  console.log("Getting loc");
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    setErrorMsg("Permission to access location was denied");
    return;
  }

  let location = await Location.getCurrentPositionAsync({});
  setLocation(location);
  await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Highest, distanceInterval: 0.1 },
    (newLocation) => {
      setLocation(newLocation);
    },
    console.warn,
  );
}

export { getCurrentLocation };

