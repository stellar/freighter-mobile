import * as amplitude from "@amplitude/analytics-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "config/logger";
import { useAnalyticsStore } from "ducks/analytics";
import { STORAGE_KEYS, DEBUG_CONFIG } from "services/analytics/constants";
import { isInitialized } from "services/analytics/core";

// -----------------------------------------------------------------------------
// USER ID MANAGEMENT
// -----------------------------------------------------------------------------

// Fallback user ID for when AsyncStorage fails persistently
let sessionUserId: string | null = null;

/**
 * Generates a random user ID using the same format as the extension.
 */
const generateRandomUserId = (): string =>
  Math.random().toString().split(".")[1];

/**
 * Gets user ID with fallback strategy:
 * 1. Try to get from AsyncStorage
 * 2. Generate new one and store it
 * 3. Use session-only ID if storage fails
 */
export const getUserId = async (): Promise<string> => {
  try {
    const storedId = await AsyncStorage.getItem(STORAGE_KEYS.METRICS_USER_ID);

    if (storedId) {
      sessionUserId = storedId;

      return storedId;
    }

    const newId = generateRandomUserId();

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.METRICS_USER_ID, newId);

      sessionUserId = newId;

      return newId;
    } catch (setError) {
      logger.warn(
        DEBUG_CONFIG.LOG_PREFIX,
        "Failed to persist user ID, using session-only",
        setError,
      );

      sessionUserId = newId;

      return newId;
    }
  } catch (getError) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "AsyncStorage completely failed",
      getError,
    );

    // Return cached session ID if available
    if (sessionUserId) {
      logger.debug(DEBUG_CONFIG.LOG_PREFIX, "Using cached session user ID");

      return sessionUserId;
    }

    // Generate new session-only ID as last resort
    sessionUserId = generateRandomUserId();
    logger.debug(DEBUG_CONFIG.LOG_PREFIX, "Generated new session-only user ID");

    return sessionUserId;
  }
};

// -----------------------------------------------------------------------------
// USER IDENTIFICATION
// -----------------------------------------------------------------------------

// Track last identified user to prevent duplicate identification
let lastIdentifiedUserId: string | null = null;

/**
 * Identifies the user with analytics providers.
 * Handles graceful fallbacks if analytics is disabled or not initialized.
 */
export const identifyUser = async (): Promise<void> => {
  const {
    isEnabled,
    setUserId,
    userId: currentUserId,
  } = useAnalyticsStore.getState();

  if (!isEnabled || !isInitialized()) {
    return;
  }

  try {
    const userId = await getUserId();

    // Skip if we already identified this user recently
    if (lastIdentifiedUserId === userId && currentUserId === userId) {
      return;
    }

    try {
      amplitude.setUserId(userId);

      setUserId(userId);

      lastIdentifiedUserId = userId;

      logger.debug(DEBUG_CONFIG.LOG_PREFIX, `✅ User identified: ${userId}`);
    } catch (amplitudeError) {
      // Store user ID even if amplitude fails
      setUserId(userId);

      lastIdentifiedUserId = userId;

      logger.warn(
        DEBUG_CONFIG.LOG_PREFIX,
        "Failed to set user ID in Amplitude, but stored locally",
        { userId, amplitudeError },
      );
    }
  } catch (userIdError) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Failed to get user ID for identification",
      {
        userIdError,
        analyticsEnabled: isEnabled,
      },
    );
  }
};
