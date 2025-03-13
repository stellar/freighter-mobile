/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, no-param-reassign */
import BigNumber from "bignumber.js";
import isArray from "lodash/isArray";
import isObject from "lodash/isObject";

/**
 * Interface for mapping keys that need to be converted to BigNumber
 */
interface KeyMap {
  [key: string]: boolean;
}

/**
 * Generic type for the object to be processed
 * T can be any object, array, or primitive type
 */
type Bigizable<T> = T extends object ? T : T;

/**
 * Converts specified numeric properties in an object or object tree to BigNumber instances.
 *
 * This utility recursively traverses through objects and arrays, looking for properties
 * whose names match those in the provided `keys` array, and converts their values to
 * BigNumber instances if they represent valid numbers.
 *
 * @param obj - The object or array to process
 * @param keys - Array of property names to convert to BigNumber
 * @returns A new object with the specified properties converted to BigNumber
 *
 * @example
 * // Convert specific numeric fields in a simple object
 * const user = { id: 123, balance: "1234.56789", name: "Alice" };
 * const result = bigize(user, ["balance"]);
 * // result: { id: 123, balance: BigNumber(1234.56789), name: "Alice" }
 *
 * @example
 * // Process nested objects and arrays
 * const accounts = {
 *   users: [
 *     { id: 1, balance: "100.5" },
 *     { id: 2, balance: "200.75" }
 *   ],
 *   total: "301.25"
 * };
 * const result = bigize(accounts, ["balance", "total"]);
 * // result.users[0].balance and result.total are now BigNumber instances
 *
 * @example
 * // Use with API responses
 * const apiResponse = await fetchAccountBalances();
 * const processedResponse = bigize(apiResponse, [
 *   "available", "total", "limit", "minimumBalance"
 * ]);
 */
export function bigize<T>(obj: T, keys: string[] = []): Bigizable<T> {
  // Create a map for O(1) lookups of keys to convert
  const keyMap: KeyMap = keys.reduce(
    (memo, key) => ({ ...memo, [key]: true }),
    {},
  );

  // Handle arrays recursively
  if (isArray(obj)) {
    return obj.map((item) => bigize(item, keys)) as Bigizable<T>;
  }

  // Early return for non-objects
  if (!isObject(obj)) {
    return obj as Bigizable<T>;
  }

  // Don't modify BigNumber instances
  if (BigNumber.isBigNumber(obj)) {
    return obj as Bigizable<T>;
  }

  // Configure BigNumber to avoid exponential notation for large numbers
  BigNumber.config({ EXPONENTIAL_AT: 1e9 });

  // Process each property of the object
  const result = Object.keys(obj as object).reduce(
    (memo: Record<string, any>, key: string) => {
      const value = (obj as Record<string, any>)[key];

      // Check if this key should be converted to BigNumber
      if (keyMap[key] && typeof value !== "object") {
        // Skip null/undefined values
        if (value === null || value === undefined) {
          memo[key] = value;
        } else {
          // Convert to BigNumber with 7 decimal places, rounding half up
          memo[key] = new BigNumber(value).decimalPlaces(
            7,
            BigNumber.ROUND_HALF_UP,
          );
        }
      } else {
        // Recursively process nested objects/arrays
        memo[key] = bigize(value, keys);
      }

      return memo;
    },
    {},
  );

  return result as Bigizable<T>;
}
