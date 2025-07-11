import AsyncStorage from "@react-native-async-storage/async-storage";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { BrowserTab } from "ducks/browserTabs";
import ViewShot from "react-native-view-shot";

export interface ScreenshotData {
  tabId: string;
  tabUrl: string;
  uri: string; // base64 image data URI
  timestamp: number;
}

export const getStoredScreenshots = async (): Promise<ScreenshotData[]> => {
  try {
    const data = await AsyncStorage.getItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
    );
    return data ? (JSON.parse(data) as ScreenshotData[]) : [];
  } catch (error) {
    logger.error("screenshots", "Failed to get stored screenshots:", error);
    return [];
  }
};

export const findTabScreenshot = async (
  tabId: string,
  tabUrl?: string,
): Promise<ScreenshotData | null> => {
  if (!tabUrl || tabUrl === BROWSER_CONSTANTS.HOMEPAGE_URL) return null;

  try {
    const screenshots = await getStoredScreenshots();
    const matchingScreenshots = screenshots.filter(
      (screenshot) => screenshot.tabId === tabId,
    );
    const screenshotsWithMatchingUrl = matchingScreenshots.filter(
      (screenshot) => screenshot.tabUrl === tabUrl,
    );

    if (screenshotsWithMatchingUrl.length > 0) {
      // Return the most recent screenshot
      return screenshotsWithMatchingUrl.reduce((a, b) =>
        a.timestamp > b.timestamp ? a : b,
      );
    }
  } catch (error) {
    logger.error("screenshots", "Failed to find tab screenshot:", error);
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
      (s) => !(s.tabId === screenshot.tabId && s.tabUrl === screenshot.tabUrl),
    );

    // Add new screenshot
    const updatedScreenshots = [...filteredScreenshots, screenshot];

    // Keep only the most recent screenshots to prevent storage bloat
    const sortedScreenshots = updatedScreenshots
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, BROWSER_CONSTANTS.MAX_SCREENSHOTS_STORED);

    await AsyncStorage.setItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      JSON.stringify(sortedScreenshots),
    );
  } catch (error) {
    logger.error("screenshots", "Failed to save screenshot:", error);
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
      activeTabIdsSet.has(screenshot.tabId),
    );

    await AsyncStorage.setItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      JSON.stringify(screenshotsToKeep),
    );
  } catch (error) {
    logger.error("screenshots", "Failed to prune screenshots:", error);
  }
};

export const clearAllScreenshots = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY);
  } catch (error) {
    logger.error("screenshots", "Failed to clear screenshots:", error);
  }
};

export interface CaptureScreenshotParams {
  viewShotRef: ViewShot | null;
  tabId: string;
  tabs: BrowserTab[];
  updateTab: (tabId: string, updates: Partial<BrowserTab>) => void;
  source: string; // used for logging
}

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

      // Save to persistent storage
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        const screenshotData: ScreenshotData = {
          tabId,
          timestamp: Date.now(),
          uri,
          tabUrl: tab.url,
        };

        await saveScreenshot(screenshotData);
        updateTab(tabId, { screenshot: uri });

        logger.debug(source, `Screenshot captured for tab ${tabId}`);
      }
    }
  } catch (error) {
    logger.error(source, "Failed to capture screenshot:", error);
  }
};
