import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DocumentDirectoryPath,
  exists,
  mkdir,
  readDir,
  readFile,
  unlink,
  writeFile,
} from "@dr.pogodin/react-native-fs";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { BrowserTab } from "ducks/browserTabs";
import {
  decryptScreenshot,
  encryptScreenshot,
  resetScreenshotDek,
} from "helpers/screenshotCrypto";
import ViewShot from "react-native-view-shot";

/**
 * Metadata for a stored screenshot — kept in AsyncStorage.
 * Image bytes live in an encrypted file on the filesystem, never in AsyncStorage.
 */
export interface ScreenshotMeta {
  tabId: string;
  tabUrl: string;
  timestamp: number;
  file: string; // filename inside SCREENSHOT_FILES_DIR, e.g. "<tabId>.enc"
}

/**
 * ScreenshotMeta plus the decrypted data URI (in-memory only, never persisted).
 */
export interface ScreenshotData extends ScreenshotMeta {
  uri: string;
}

const screenshotsDir = (): string =>
  `${DocumentDirectoryPath}/${BROWSER_CONSTANTS.SCREENSHOT_FILES_DIR}`;

const encFilePath = (fileName: string): string =>
  `${screenshotsDir()}/${fileName}`;

/**
 * Retrieves all stored screenshot metadata from AsyncStorage as a Map.
 */
export const getStoredScreenshots = async (): Promise<
  Map<string, ScreenshotMeta>
> => {
  try {
    const data = await AsyncStorage.getItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
    );
    if (!data) return new Map();

    const parsed = JSON.parse(data) as Record<string, ScreenshotMeta>;
    return new Map(Object.entries(parsed));
  } catch (error) {
    logger.error("screenshots", "Failed to get stored screenshots:", error);
    return new Map();
  }
};

/**
 * Finds and decrypts the screenshot for a given tab.
 * Returns null when not found, when the file is missing, or on any decrypt failure.
 */
export const findTabScreenshot = async (
  tabId: string,
): Promise<ScreenshotData | null> => {
  try {
    const metaMap = await getStoredScreenshots();
    const meta = metaMap.get(tabId);
    if (!meta) return null;

    const filePath = encFilePath(meta.file);
    if (!(await exists(filePath))) {
      // Stale metadata — clean it up silently
      metaMap.delete(tabId);
      await AsyncStorage.setItem(
        BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(metaMap)),
      );
      return null;
    }

    const encryptedContent = await readFile(filePath, "base64");
    const uri = await decryptScreenshot(encryptedContent);
    return { ...meta, uri };
  } catch (error) {
    logger.error("screenshots", "Failed to find tab screenshot:", error);
    return null;
  }
};

/**
 * Removes a specific screenshot file and its metadata entry.
 */
export const removeTabScreenshot = async (tabId: string): Promise<boolean> => {
  try {
    const metaMap = await getStoredScreenshots();
    const meta = metaMap.get(tabId);

    if (meta) {
      const filePath = encFilePath(meta.file);
      if (await exists(filePath)) {
        await unlink(filePath);
      }
      metaMap.delete(tabId);
      await AsyncStorage.setItem(
        BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(metaMap)),
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
 * Encrypts and saves a screenshot to disk, storing only metadata in AsyncStorage.
 * Evicts the oldest entries when MAX_SCREENSHOTS_STORED is exceeded.
 */
export const saveScreenshot = async (
  tabId: string,
  tabUrl: string,
  plaintextUri: string,
): Promise<void> => {
  try {
    const dir = screenshotsDir();
    if (!(await exists(dir))) {
      await mkdir(dir);
    }

    const encryptedContent = await encryptScreenshot(plaintextUri);
    const fileName = `${tabId}.enc`;
    await writeFile(encFilePath(fileName), encryptedContent, "base64");

    const metaMap = await getStoredScreenshots();
    metaMap.set(tabId, {
      tabId,
      tabUrl,
      timestamp: Date.now(),
      file: fileName,
    });

    if (metaMap.size > BROWSER_CONSTANTS.MAX_SCREENSHOTS_STORED) {
      const sorted = Array.from(metaMap.values()).sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      const kept = new Set(
        sorted
          .slice(0, BROWSER_CONSTANTS.MAX_SCREENSHOTS_STORED)
          .map((m) => m.tabId),
      );

      for (const [evictedId, evictedMeta] of metaMap.entries()) {
        if (!kept.has(evictedId)) {
          unlink(encFilePath(evictedMeta.file)).catch(() => {});
          metaMap.delete(evictedId);
        }
      }
    }

    await AsyncStorage.setItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(metaMap)),
    );
  } catch (error) {
    logger.error("screenshots", "Failed to save screenshot:", error);
  }
};

/**
 * Clears all screenshot files and the metadata key from AsyncStorage.
 */
export const clearAllScreenshots = async (): Promise<boolean> => {
  try {
    logger.debug("clearAllScreenshots", "Starting screenshot cleanup");
    const dir = screenshotsDir();
    if (await exists(dir)) {
      const files = await readDir(dir);
      await Promise.all(files.map((f) => unlink(f.path)));
    }
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
 */
export const pruneScreenshots = async (
  activeTabIds: string[],
): Promise<void> => {
  try {
    if (activeTabIds.length === 0) {
      await clearAllScreenshots();
      return;
    }

    const metaMap = await getStoredScreenshots();
    const activeSet = new Set(activeTabIds);

    const deletePromises: Promise<void>[] = [];
    for (const [tabId, meta] of metaMap.entries()) {
      if (!activeSet.has(tabId)) {
        const filePath = encFilePath(meta.file);
        deletePromises.push(
          exists(filePath).then((fileExists) =>
            fileExists ? unlink(filePath) : Promise.resolve(),
          ),
        );
        metaMap.delete(tabId);
      }
    }

    await Promise.all(deletePromises);
    await AsyncStorage.setItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(metaMap)),
    );
  } catch (error) {
    logger.error("screenshots", "Failed to prune screenshots:", error);
  }
};

/**
 * Migrates the old unencrypted AsyncStorage blob to the new per-file format.
 *
 * The old format stored { tabId: { uri, tabUrl, timestamp } } — image bytes in
 * AsyncStorage. If detected, the blob is deleted and the DEK is rotated so any
 * already-derived key is not reused with the new layout. Thumbnails regenerate
 * on the next browse session; TabPreview gracefully falls back to favicon/home.
 */
export const migrateOldScreenshots = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(
      BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
    );
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entries = Object.values(parsed);
    const isOldFormat =
      entries.length > 0 &&
      entries.some(
        (entry) =>
          entry !== null &&
          typeof entry === "object" &&
          "uri" in (entry as object),
      );

    if (isOldFormat) {
      logger.debug(
        "migrateOldScreenshots",
        "Old unencrypted screenshot blob detected — clearing and rotating DEK",
      );
      await AsyncStorage.removeItem(BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY);
      await resetScreenshotDek();
    }
  } catch (error) {
    logger.error(
      "migrateOldScreenshots",
      "Migration check failed — clearing screenshots to be safe:",
      error,
    );
    await AsyncStorage.removeItem(BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY).catch(() => {});
  }
};

/**
 * Parameters for capturing a screenshot of a tab.
 */
export interface CaptureScreenshotParams {
  viewShotRef: ViewShot | null;
  tabId: string;
  tabs: BrowserTab[];
  updateTab: (tabId: string, updates: Partial<BrowserTab>) => void;
  source: string;
}

/**
 * Captures a screenshot, encrypts it, writes it to disk, and updates in-memory tab state.
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
      const tab = tabs.find((t) => t.id === tabId);

      if (tab) {
        await saveScreenshot(tabId, tab.url, uri);
        updateTab(tabId, { screenshot: uri });
        logger.debug(source, `Screenshot captured for tab ${tabId}`);
      }
    }
  } catch (error) {
    // Browser-tab thumbnails are a non-essential UX nicety. The capture
    // can fail for a few reasons that are all environmental races, not
    // bugs in our code:
    //   - "Failed to capture view snapshot" - the bitmap render fails,
    //     usually because of low memory or hardware-accelerated
    //     WebView surfaces.
    //   - "No view found with reactTag: NNNN" - the React Native view
    //     was already unmounted by the time native code looked it up
    //     (tab disposal, navigation away mid-capture).
    //   - iOS "drawViewHierarchyInRect was not successful" - iOS
    //     variant of the same condition for offscreen / mid-transition
    //     views.
    // When capture fails, the tab switcher falls back to favicon/URL.
    // Use info so this stays local-only and doesn't take up a Sentry
    // breadcrumb slot for an unrelated error later in the session.
    logger.info(
      source,
      `Failed to capture screenshot for tab ${tabId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
