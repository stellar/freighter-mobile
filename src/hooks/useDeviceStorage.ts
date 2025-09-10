import {
  DocumentDirectoryPath,
  downloadFile,
  exists,
  unlink,
} from "@dr.pogodin/react-native-fs";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { logger, normalizeError } from "config/logger";
import { isAndroid } from "helpers/device";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback } from "react";
import { Platform } from "react-native";
import {
  PERMISSIONS,
  RESULTS,
  check,
  checkMultiple,
  request,
  requestMultiple,
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

const hasAndroidPermission = async (): Promise<boolean> => {
  const getCheckPermissionPromise = async (): Promise<boolean> => {
    if (Number(Platform.Version) >= 33) {
      const statuses = await checkMultiple([
        PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
        PERMISSIONS.ANDROID.READ_MEDIA_VIDEO,
      ]);

      return (
        statuses[PERMISSIONS.ANDROID.READ_MEDIA_IMAGES] === RESULTS.GRANTED &&
        statuses[PERMISSIONS.ANDROID.READ_MEDIA_VIDEO] === RESULTS.GRANTED
      );
    }
    const status = await check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);

    return status === RESULTS.GRANTED;
  };

  const hasPermission = await getCheckPermissionPromise();

  if (hasPermission) {
    return true;
  }

  const getRequestPermissionPromise = async (): Promise<boolean> => {
    if (Number(Platform.Version) >= 33) {
      const statuses = await requestMultiple([
        PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
        PERMISSIONS.ANDROID.READ_MEDIA_VIDEO,
      ]);

      return (
        statuses[PERMISSIONS.ANDROID.READ_MEDIA_IMAGES] === RESULTS.GRANTED &&
        statuses[PERMISSIONS.ANDROID.READ_MEDIA_VIDEO] === RESULTS.GRANTED
      );
    }
    const status = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);

    return status === RESULTS.GRANTED;
  };

  return getRequestPermissionPromise();
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
      if (isAndroid && !(await hasAndroidPermission())) {
        return;
      }

      tempFilePath = await downloadImageToTemp(imageUrl, imageName);

      if (!tempFilePath) {
        showToast({
          title: t("collectibleDetails.imageSaveFailed"),
          variant: "error",
        });

        return;
      }

      CameraRoll.saveAsset(tempFilePath)
        .then((image) => {
          logger.info(
            "DeviceStorage",
            "Image successfully saved to photos",
            image,
          );

          showToast({
            title: t("collectibleDetails.imageSavedToPhotos"),
            variant: "success",
          });
        })
        .catch((error) => {
          logger.error(
            "DeviceStorage",
            "Failed to save image to photos",
            error,
          );

          showToast({
            title: t("collectibleDetails.imageSaveAttempted"),
            variant: "warning",
          });
        })
        .finally(() => {
          // Delay the deletion of the temp file to ensure the image is saved to the camera roll
          setTimeout(() => {
            if (tempFilePath) {
              deleteTempFile(tempFilePath);
            }
          }, 5000);
        });
    },
    [showToast, t],
  );

  return {
    saveToPhotos,
  };
};

export default useDeviceStorage;
