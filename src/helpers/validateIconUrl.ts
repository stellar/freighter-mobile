import FastImage from "@d11/react-native-fast-image";
import { debug } from "helpers/debug";

/**
 * Timeout in milliseconds for validating icon URLs.
 * If the HEAD request doesn't resolve within this window the URL is considered
 * unreachable and validation returns false.
 */
export const ICON_VALIDATION_TIMEOUT = 3000;

/**
 * Validates an icon URL and pre-warms FastImage's cache.
 *
 * Validation pipeline:
 * 1. Rejects empty / non-string values immediately.
 * 2. Accepts `data:image/` URIs — other data: subtypes (text/html, etc.) are
 *    rejected to prevent unexpected content.
 * 3. For http/https URLs, races a HEAD request against a 3-second timeout:
 *    - HEAD success  → calls FastImage.preload to cache via SDWebImage/Glide,
 *                      returns true
 *    - HEAD failure  → returns false (404, network error, etc.)
 *    - timeout       → returns false (slow or unreachable host)
 * 4. Any other scheme (file://, ftp://, javascript:, blob:, etc.) is rejected.
 *    Bundled Metro assets are Numbers, not strings, so they never reach this
 *    function; the only legitimate string values are http(s) URLs and the
 *    inline `data:image/` URIs from step 2.
 *
 * Note: The Zustand store's `isValidated` optimistic-lock guarantees this
 * function is called at most once per icon URL, so redundant network requests
 * are never issued even when multiple components mount for the same token.
 *
 * @param url - The URL to validate
 * @returns `true` if the image is reachable and has been queued for caching
 */
export const validateIconUrl = async (url: string): Promise<boolean> => {
  if (!url || typeof url !== "string") return false;

  // Allow data: URIs only for image content.  Non-image data URIs
  // (text/html, application/javascript, etc.) are rejected.
  if (url.startsWith("data:")) {
    return url.startsWith("data:image/");
  }

  // Reject any scheme that is not http or https.
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }

  try {
    // Timeout rejects so the outer catch returns false.
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Icon validation timeout for ${url}`)),
        ICON_VALIDATION_TIMEOUT,
      );
    });

    const fetchPromise = fetch(url, { method: "HEAD" })
      .then((response) => {
        if (response.ok) {
          debug("validateIconUrl", `Validated: ${url}`);
          // Pre-warm FastImage's SDWebImage/Glide cache so the first render
          // loads from disk rather than the network.
          FastImage.preload([{ uri: url }]);
          return true as boolean;
        }
        debug(
          "validateIconUrl",
          `Validation failed for ${url}: ${response.status}`,
        );
        return false as boolean;
      })
      .catch((error: unknown) => {
        debug("validateIconUrl", `Fetch failed for ${url}: ${String(error)}`);
        return false as boolean;
      });

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    debug("validateIconUrl", `Validation error for ${url}: ${String(error)}`);
    return false;
  }
};
