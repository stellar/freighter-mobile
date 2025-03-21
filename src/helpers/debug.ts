/*
  eslint-disable
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-argument,
  @typescript-eslint/no-unsafe-return
*/

/** Determines if debug logging is enabled (only in development mode) */
const DEBUG = __DEV__;

/**
 * Generates a formatted timestamp string in the format HH:MM:SS.mmm
 *
 * @returns {string} Formatted timestamp string
 *
 * @example
 * // Returns something like "14:35:22.456"
 * getTimestamp();
 *
 * @internal
 */
const getTimestamp = () => {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

/**
 * Formats log payloads for more readable console output
 * Converts objects to pretty-printed JSON strings
 *
 * @param {any} payload - The payload to format
 * @returns {string | any} Formatted payload as string or original payload if formatting fails
 *
 * @internal
 */
const formatArgs = (payload: any) => {
  if (typeof payload === "string") {
    return payload;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    return payload;
  }
};

/**
 * Logs debug information to the console with timestamp and category indicators
 * Only works in development mode (when __DEV__ is true)
 *
 * @param {string} category - Category label for the log message
 * @param {...any} args - Arguments to log
 *
 * @example
 * // Logs with timestamp and "API Request" category
 * debug("API Request", { url: "/api/balances", method: "GET" });
 *
 * // Logs multiple arguments
 * debug("User Action", "Button clicked", { id: "submit-btn" });
 */
export const debug = (category: string, ...args: any[]) => {
  if (!DEBUG) return;

  const timestamp = getTimestamp();
  const timeTag = `\x1b[32m[${timestamp}]\x1b[0m `;
  const categoryTag = `\x1b[36m[${category}]\x1b[0m`;
  const formattedArgs = args.map(formatArgs);

  // eslint-disable-next-line no-console
  console.log(`${timeTag}${categoryTag}`, ...formattedArgs);
};
