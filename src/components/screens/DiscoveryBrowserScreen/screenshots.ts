import AsyncStorage from "@react-native-async-storage/async-storage";
import { debug } from "helpers/debug";

export interface ScreenshotData {
  id: string; // tab ID
  timestamp: number;
  uri: string; // base64 data URI
  url: string;
}

const SCREENSHOT_STORAGE_KEY = "browser_screenshots";

export const getStoredScreenshots = async (): Promise<ScreenshotData[]> => {
  try {
    const data = await AsyncStorage.getItem(SCREENSHOT_STORAGE_KEY);
    return data ? (JSON.parse(data) as ScreenshotData[]) : [];
  } catch (error) {
    debug("screenshots", "Failed to get stored screenshots:", error);
    return [];
  }
};

export const findTabScreenshot = async (
  tabId: string,
  url?: string,
): Promise<ScreenshotData | null> => {
  if (!url || url === "freighter://homepage") return null;

  try {
    const screenshots = await getStoredScreenshots();
    const matchingScreenshots = screenshots.filter(
      (screenshot) => screenshot.id === tabId,
    );
    const screenshotsWithMatchingUrl = matchingScreenshots.filter(
      (screenshot) => screenshot.url === url,
    );

    if (screenshotsWithMatchingUrl.length > 0) {
      // Return the most recent screenshot
      return screenshotsWithMatchingUrl.reduce((a, b) =>
        a.timestamp > b.timestamp ? a : b,
      );
    }
  } catch (error) {
    debug("screenshots", "Failed to find tab screenshot:", error);
  }

  return null;
};

export const saveScreenshot = async (
  screenshot: ScreenshotData,
): Promise<void> => {
  try {
    const screenshots = await getStoredScreenshots();

    // Remove old screenshots for the same tab and URL
    const filteredScreenshots = screenshots.filter(
      (s) => !(s.id === screenshot.id && s.url === screenshot.url),
    );

    // Add new screenshot
    const updatedScreenshots = [...filteredScreenshots, screenshot];

    // Keep only the 50 most recent screenshots to prevent storage bloat
    const sortedScreenshots = updatedScreenshots
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);

    await AsyncStorage.setItem(
      SCREENSHOT_STORAGE_KEY,
      JSON.stringify(sortedScreenshots),
    );
  } catch (error) {
    debug("screenshots", "Failed to save screenshot:", error);
  }
};

export const pruneScreenshots = async (
  activeTabIds: string[],
): Promise<void> => {
  try {
    const screenshots = await getStoredScreenshots();
    const activeTabIdsSet = new Set(activeTabIds);

    // Keep only screenshots for active tabs
    const screenshotsToKeep = screenshots.filter((screenshot) =>
      activeTabIdsSet.has(screenshot.id),
    );

    await AsyncStorage.setItem(
      SCREENSHOT_STORAGE_KEY,
      JSON.stringify(screenshotsToKeep),
    );
  } catch (error) {
    debug("screenshots", "Failed to prune screenshots:", error);
  }
};

export const clearAllScreenshots = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SCREENSHOT_STORAGE_KEY);
  } catch (error) {
    debug("screenshots", "Failed to clear screenshots:", error);
  }
};
