import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { useCallback } from "react";
import { Platform } from "react-native";
import {
  checkMultiple,
  requestMultiple,
  PERMISSIONS,
  RESULTS,
} from "react-native-permissions";

const hasAndroidPermission = async () => {
  const permissions =
    Number(Platform.Version) >= 33
      ? [
          PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
          PERMISSIONS.ANDROID.READ_MEDIA_VIDEO,
        ]
      : [PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE];

  const statuses = await checkMultiple(permissions);
  const allGranted = permissions.every(
    (permission) => statuses[permission] === RESULTS.GRANTED,
  );

  if (allGranted) {
    return true;
  }

  const requestStatuses = await requestMultiple(permissions);
  return permissions.every(
    (permission) => requestStatuses[permission] === RESULTS.GRANTED,
  );
};

const useDeviceStorage = () => {
  const saveToPhotos = useCallback(async (image: string) => {
    if (Platform.OS === "android" && !(await hasAndroidPermission())) {
      return;
    }

    CameraRoll.saveAsset(image);
  }, []);

  return {
    saveToPhotos,
  };
};

export default useDeviceStorage;
