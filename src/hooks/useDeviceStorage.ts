import {
  DocumentDirectoryPath,
  downloadFile,
  exists,
  unlink,
} from "@dr.pogodin/react-native-fs";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { logger, normalizeError } from "config/logger";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback } from "react";
import { Platform } from "react-native";
import {
  checkMultiple,
  requestMultiple,
  PERMISSIONS,
  RESULTS,
} from "react-native-permissions";

/**
 * Extracts file extension from URL and validates it's a supported image format
 * @param imageUrl - URL to extract extension from
 * @returns string - Valid image extension or 'jpg' as fallback
 */
const getImageExtensionFromUrl = (imageUrl: string): string => {
  try {
    // Remove query parameters and get the last part after the last dot
    const cleanUrl = imageUrl.split("?")[0];
    const parts = cleanUrl.split(".");

    if (parts.length > 1) {
      const extension = parts[parts.length - 1].toLowerCase();

      const supportedFormats = [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "bmp",
        "tiff",
      ];

      if (supportedFormats.includes(extension)) {
        return extension;
      }
    }
  } catch (error) {
    logger.warn("DeviceStorage", "Failed to extract extension from URL", {
      imageUrl,
      error,
    });
  }

  return "jpg";
};

// TODO: use normalizeError when PR #318 is merged
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

/**
 * Downloads an image from a remote URL to a temporary local file with proper format detection
 * @param imageUrl - The remote URL of the image to download
 * @param imageName - Base name for the downloaded file
 * @returns Promise<string> - The local file path of the downloaded image
 */
const downloadImageToTemp = async (
  imageUrl: string,
  imageName: string,
): Promise<string> => {
  const extension = getImageExtensionFromUrl(imageUrl);
  const fileName = `${imageName}_${Date.now()}.${extension}`;
  const localFilePath = `${DocumentDirectoryPath}/${fileName}`;

  const downloadResult = await downloadFile({
    fromUrl: imageUrl,
    toFile: localFilePath,
  }).promise;

  if (downloadResult.statusCode !== 200) {
    throw normalizeError(
      `Download failed with status code: ${downloadResult.statusCode}`,
    );
  }

  return localFilePath;
};

/**
 * Deletes a temporary file from the device
 * @param filePath - The local file path to delete
 */
const deleteTempFile = async (filePath: string): Promise<void> => {
  try {
    const existsResult = await exists(filePath);

    if (existsResult) {
      await unlink(filePath);
    }
  } catch (error) {
    logger.error("DeviceStorage", "Error deleting temporary file", error);
    // Don't throw here as this is cleanup and shouldn't fail the main operation
  }
};

const useDeviceStorage = () => {
  const { showToast } = useToast();
  const { t } = useAppTranslation();
  const saveToPhotos = useCallback(
    async (imageUrl: string, imageName: string) => {
      let tempFilePath: string | null = null;

      // Check only for android because the react-native-camera-roll already handles iOS
      if (Platform.OS === "android" && !(await hasAndroidPermission())) {
        return;
      }

      tempFilePath = await downloadImageToTemp(imageUrl, imageName);

      CameraRoll.saveAsset(tempFilePath).finally(() => {
        showToast({
          title: t("collectibleDetails.imageSavedToPhotos"),
          variant: "success",
        });

        // Delay the deletion of the temp file to ensure the image is saved to the camera roll
        setTimeout(() => {
          if (tempFilePath) {
            deleteTempFile(tempFilePath);
          }
        }, 1000);
      });
    },
    [showToast, t],
  );

  return {
    saveToPhotos,
  };
};

export default useDeviceStorage;
