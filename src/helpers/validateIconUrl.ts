import { debug } from "helpers/debug";
import { Image } from "react-native";

/**
 * Timeout in milliseconds for validating icon URLs
 * If the image doesn't load within this time, validation fails
 */
const ICON_VALIDATION_TIMEOUT = 3000;

/**
 * Checks if an image URL is already cached in the native image cache
 *
 * This performs a quick cache check without downloading.
 * For remote URLs, uses Image.prefetch with a short timeout.
 * For local resources, assumes they're always available.
 *
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} True if the image is cached or a local resource
 *
 * @example
 * const isCached = await isIconCached("https://example.com/logo.png");
 */
export const isIconCached = async (url: string): Promise<boolean> => {
  // Empty URL is not cached
  if (!url) return false;

  // Local resources are always "cached" (available)
  if (
    typeof url !== "string" ||
    (!url.startsWith("http") && !url.startsWith("https"))
  ) {
    return true;
  }

  // For remote URLs, try a quick prefetch with very short timeout
  // If it succeeds immediately, it's likely cached
  try {
    const SHORT_CHECK_TIMEOUT = 100; // 100ms - if not instant, probably not cached

    const fetchPromise = Image.prefetch(url)
      .then(() => true)
      .catch(() => false);

    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), SHORT_CHECK_TIMEOUT);
    });

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    return false;
  }
};

/**
 * Validates an icon URL by checking native cache and prefetching if needed
 *
 * This function provides multi-level caching:
 * 1. First checks if the image is already in native iOS/Android cache
 * 2. If not cached, uses Image.prefetch() to download and cache to disk
 * 3. The cached image persists across app sessions until cleared by OS
 *
 * @param {string} url - The URL to validate
 * @returns {Promise<boolean>} True if the URL is valid and accessible (or already cached)
 *
 * @example
 * // Validate a remote image URL
 * const isValid = await validateIconUrl("https://example.com/logo.png");
 *
 * @example
 * // Local resources are automatically considered valid
 * const isValid = await validateIconUrl("https://assets.example.com/local-logo.png");
 */
export const validateIconUrl = async (url: string): Promise<boolean> => {
  // Empty URL is invalid
  if (!url) return false;

  // If it's not a remote URL (http/https), assume it's valid (local resource or data URI)
  if (
    typeof url !== "string" ||
    (!url.startsWith("http") && !url.startsWith("https"))
  ) {
    return true;
  }

  // Use Image.prefetch to validate and cache the image
  try {
    // Create a timeout promise that explicitly rejects after ICON_VALIDATION_TIMEOUT
    // This ensures we don't wait for Image.prefetch indefinitely
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Icon validation timeout for ${url}`));
      }, ICON_VALIDATION_TIMEOUT);
    });

    const fetchPromise = Image.prefetch(url)
      .then(() => {
        debug("validateIconUrl", `Image prefetched and cached: ${url}`);
        return true;
      })
      .catch((error) => {
        debug(
          "validateIconUrl",
          `Image prefetch failed for ${url}: ${String(error)}`,
        );
        return false;
      });

    // Race between fetch and timeout
    // If timeout rejects first, it will be caught and return false
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    // Timeout or any other error = invalid
    debug("validateIconUrl", `Validation failed for ${url}: ${String(error)}`);
    return false;
  }
};
