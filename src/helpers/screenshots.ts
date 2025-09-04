import AsyncStorage from "@react-native-async-storage/async-storage";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger, normalizeError } from "config/logger";
import { BrowserTab } from "ducks/browserTabs";
import { Platform } from "react-native";
import {
  BorderTypes,
  DataTypes,
  ObjectType,
  OpenCV,
} from "react-native-fast-opencv";
import ViewShot from "react-native-view-shot";

/**
 * Represents a screenshot associated with a browser tab.
 * @property tabId - The ID of the tab
 * @property tabUrl - The URL of the tab
 * @property uri - Base64 image data URI
 * @property timestamp - When the screenshot was taken
 */
export interface ScreenshotData {
  tabId: string;
  tabUrl: string;
  uri: string; // base64 image data URI
  timestamp: number;
}

/**
 * Retrieves all stored screenshots from persistent storage as a Map for O(1) lookups.
 * @returns Promise<Map<string, ScreenshotData>> - Map of tabId to screenshot data
 */
export const getStoredScreenshots = async (): Promise<
  Map<string, ScreenshotData>
> => {
  try {
    const data = await AsyncStorage.getItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
    );
    if (!data) return new Map();

    const screenshotsMap = JSON.parse(data) as Record<string, ScreenshotData>;
    return new Map(Object.entries(screenshotsMap));
  } catch (error) {
    logger.error("screenshots", "Failed to get stored screenshots:", error);

    return new Map();
  }
};

/**
 * Finds screenshot for a given tab.
 * @param tabId - The ID of the tab
 * @returns Promise<ScreenshotData | null> - The screenshot data or null if not found
 */
export const findTabScreenshot = async (
  tabId: string,
): Promise<ScreenshotData | null> => {
  try {
    const screenshotsMap = await getStoredScreenshots();
    return screenshotsMap.get(tabId) || null;
  } catch (error) {
    logger.error("screenshots", "Failed to find tab screenshot:", error);
  }

  return null;
};

/**
 * Removes a specific screenshot from persistent storage.
 * @param tabId - The ID of the tab whose screenshot should be removed
 * @returns Promise<boolean> - True if removed successfully, false otherwise
 */
export const removeTabScreenshot = async (tabId: string): Promise<boolean> => {
  try {
    const screenshotsMap = await getStoredScreenshots();

    if (screenshotsMap.has(tabId)) {
      screenshotsMap.delete(tabId);

      await AsyncStorage.setItem(
        BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(screenshotsMap)),
      );

      logger.debug(
        "removeTabScreenshot",
        `Screenshot removed for tab ${tabId}`,
      );
    }

    return true;
  } catch (error) {
    logger.error("removeTabScreenshot", "Failed to remove screenshot:", error);

    return false;
  }
};

/**
 * Saves a screenshot to persistent storage, keeping only the most recent ones.
 * @param screenshot - The screenshot data to save
 * @returns Promise<void>
 */
export const saveScreenshot = async (
  screenshot: ScreenshotData,
): Promise<void> => {
  try {
    const screenshotsMap = await getStoredScreenshots();

    // Add new screenshot (automatically replaces old one for same tabId)
    screenshotsMap.set(screenshot.tabId, screenshot);

    // Keep only the most recent screenshots to prevent storage bloat
    let limitedScreenshotsMap = screenshotsMap;
    if (screenshotsMap.size > BROWSER_CONSTANTS.MAX_SCREENSHOTS_STORED) {
      const sortedScreenshots = Array.from(screenshotsMap.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, BROWSER_CONSTANTS.MAX_SCREENSHOTS_STORED);

      // Convert back to Map and store as object
      limitedScreenshotsMap = new Map(
        sortedScreenshots.map((scrshot) => [scrshot.tabId, scrshot]),
      );
    }

    await AsyncStorage.setItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(limitedScreenshotsMap)),
    );
  } catch (error) {
    logger.error("screenshots", "Failed to save screenshot:", error);
  }
};

/**
 * Clears all screenshots from persistent storage.
 * @returns Promise<boolean> - True if cleared successfully, false otherwise
 */
export const clearAllScreenshots = async (): Promise<boolean> => {
  try {
    logger.debug("clearAllScreenshots", "Starting screenshot cleanup");
    await AsyncStorage.removeItem(BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY);
    logger.debug("clearAllScreenshots", "All screenshots cleared successfully");
    return true;
  } catch (error) {
    logger.error("clearAllScreenshots", "Failed to clear screenshots:", error);

    return false;
  }
};

/**
 * Removes screenshots for tabs that are no longer active.
 * @param activeTabIds - Array of currently active tab IDs
 * @returns Promise<void>
 */
export const pruneScreenshots = async (
  activeTabIds: string[],
): Promise<void> => {
  try {
    if (activeTabIds.length === 0) {
      await clearAllScreenshots();
      return;
    }

    const screenshotsMap = await getStoredScreenshots();
    const activeTabIdsSet = new Set(activeTabIds);

    // Keep only screenshots for active tabs
    const screenshotsToKeep = Array.from(screenshotsMap.values()).filter(
      (screenshot) => activeTabIdsSet.has(screenshot.tabId),
    );

    // Convert to Map and store as object
    const filteredScreenshotsMap = new Map(
      screenshotsToKeep.map((screenshot) => [screenshot.tabId, screenshot]),
    );

    await AsyncStorage.setItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(filteredScreenshotsMap)),
    );
  } catch (error) {
    logger.error("screenshots", "Failed to prune screenshots:", error);
  }
};

/**
 * Applies a blur effect to a base64 image data URI using OpenCV.
 * @param uri - Base64 image data URI (e.g., "data:image/png;base64,iVBORw0KGgo...")
 * @returns The blurred image as a base64 string, or the original URI if blur fails
 */
const getBlurredImage = (uri: string) => {
  try {
    // Extract base64 data from data URI if present
    const base64Data = uri.includes(",") ? uri.split(",")[1] : uri;

    const mat = OpenCV.base64ToMat(base64Data);

    if (!base64Data || base64Data.length === 0) {
      logger.error(
        "getBlurredImage",
        "base64 error",
        normalizeError("Empty base64 data provided"),
      );

      return uri;
    }

    const kernelPlatform = Platform.select({
      ios: BROWSER_CONSTANTS.SCREENSHOT_BLUR_STRENGTH.EXTREMELY_STRONG,
      android: BROWSER_CONSTANTS.SCREENSHOT_BLUR_STRENGTH.VERY_STRONG,
    });

    const destination = OpenCV.createObject(
      ObjectType.Mat,
      0,
      0,
      DataTypes.CV_8U,
    );
    const kernel = OpenCV.createObject(
      ObjectType.Size,
      kernelPlatform as number,
      kernelPlatform as number,
    );

    OpenCV.invoke(
      "GaussianBlur",
      mat,
      destination,
      kernel,
      0, // sigmaX - 0 means calculate from kernel size
      0, // sigmaY - 0 means calculate from kernel size
      BorderTypes.BORDER_DEFAULT,
    );

    const result = OpenCV.toJSValue(destination);

    return `data:image/jpeg;base64,${result.base64}`;
  } catch (error) {
    logger.error("getBlurredImage", "Failed to blur image:", error);

    return uri;
  }
};

/**
 * Parameters for capturing a screenshot of a tab.
 * @property viewShotRef - Reference to the ViewShot component
 * @property tabId - The ID of the tab
 * @property tabs - Array of all browser tabs
 * @property updateTab - Function to update a tab's properties
 * @property source - Used for logging
 */
export interface CaptureScreenshotParams {
  viewShotRef: ViewShot | null;
  tabId: string;
  tabs: BrowserTab[];
  updateTab: (tabId: string, updates: Partial<BrowserTab>) => void;
  source: string; // used for logging
}

/**
 * Captures a screenshot of a tab and saves it to persistent storage.
 * @param params - CaptureScreenshotParams object
 * @returns Promise<void>
 */
export const captureTabScreenshot = async ({
  viewShotRef,
  tabId,
  tabs,
  updateTab,
  source,
}: CaptureScreenshotParams): Promise<void> => {
  logger.debug(source, "attempting to capture screenshot for tabId:", tabId);

  try {
    if (viewShotRef?.capture) {
      const uri = await viewShotRef.capture();

      const blurredUri = getBlurredImage(uri);

      // Save to persistent storage
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        const screenshotData: ScreenshotData = {
          tabId,
          timestamp: Date.now(),
          uri: blurredUri,
          tabUrl: tab.url,
        };

        await saveScreenshot(screenshotData);
        updateTab(tabId, { screenshot: blurredUri });

        logger.debug(source, `Screenshot captured for tab ${tabId}`);
      }
    }
  } catch (error) {
    logger.error(source, "Failed to capture screenshot:", error);
  } finally {
    // Clear OpenCV buffers
    // otherwise it will cause a memory leak
    OpenCV.clearBuffers();
  }
};
