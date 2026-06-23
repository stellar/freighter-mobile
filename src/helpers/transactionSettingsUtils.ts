import BigNumber from "bignumber.js";
import { FeePresets, FeePriority } from "config/types";
import { getNumberFormatSettings } from "react-native-localize";

/**
 * Enforces the device's decimal separator for settings input
 *
 * This function handles decimal separators intelligently by:
 * - If there are multiple separators, keeps only the last one as the decimal separator
 * - Removes all other separators (treating them as thousands separators)
 * - Converts the last separator to the device's configured decimal separator
 * - Designed for settings input where values can be any size
 *
 * @param {string} value - The numeric string to normalize
 * @returns {string} The string with proper decimal separator for the device locale
 *
 * @example
 * // US locale (dot decimal separator)
 * enforceSettingInputDecimalSeparator("123.45"); // Returns "123.45"
 * enforceSettingInputDecimalSeparator("123,45"); // Returns "123.45"
 * enforceSettingInputDecimalSeparator("1.000.45"); // Returns "1000.45"
 * enforceSettingInputDecimalSeparator("1,000.45"); // Returns "1000.45"
 * enforceSettingInputDecimalSeparator("12.345.678.90"); // Returns "12345678.90"
 *
 * // European locale (comma decimal separator)
 * enforceSettingInputDecimalSeparator("123.45"); // Returns "123,45"
 * enforceSettingInputDecimalSeparator("123,45"); // Returns "123,45"
 * enforceSettingInputDecimalSeparator("1.000,45"); // Returns "1000,45"
 * enforceSettingInputDecimalSeparator("1,000,45"); // Returns "1000,45"
 * enforceSettingInputDecimalSeparator("12.345.678,90"); // Returns "12345678,90"
 */
export const enforceSettingInputDecimalSeparator = (value: string): string => {
  const { decimalSeparator } = getNumberFormatSettings();

  if (!value || value.trim() === "") {
    return value;
  }

  // Count separators
  const dotCount = (value.match(/\./g) || []).length;
  const commaCount = (value.match(/,/g) || []).length;
  const totalSeparators = dotCount + commaCount;

  // If no separators or only one separator, simple replacement
  if (totalSeparators <= 1) {
    return value.replace(/[.,]/g, decimalSeparator);
  }

  // Multiple separators - find the last one to be the decimal separator
  const lastDotIndex = value.lastIndexOf(".");
  const lastCommaIndex = value.lastIndexOf(",");
  const lastSeparatorIndex = Math.max(lastDotIndex, lastCommaIndex);

  // Remove all separators except the last one, then replace the last one with device decimal separator
  const beforeLastSeparator = value.substring(0, lastSeparatorIndex);
  const afterLastSeparator = value.substring(lastSeparatorIndex + 1);

  // Reconstruct: remove all separators from before the last one, keep the last part, convert last separator
  const beforeLastWithoutSeparators = beforeLastSeparator.replace(/[.,]/g, "");
  return beforeLastWithoutSeparators + decimalSeparator + afterLastSeparator;
};

/**
 * Derives the fee priority tier that matches a given fee amount.
 *
 * Returns the matching priority (Low/Med/High) when the fee exactly equals one
 * of the network-derived presets, otherwise `FeePriority.CUSTOM`. Used to
 * highlight the correct segment in the fee priority selector — typing any value
 * that doesn't match a preset naturally lands on "Custom".
 *
 * @param {string} feeXlm - The fee amount in XLM (plain numeric string, e.g. "0.0051234")
 * @param {FeePresets} presets - The network-derived preset fees in XLM
 * @returns {FeePriority} The matching priority tier, or CUSTOM
 */
export const getFeePriority = (
  feeXlm: string,
  presets: FeePresets,
): FeePriority => {
  const fee = new BigNumber(feeXlm);

  if (fee.isNaN()) {
    return FeePriority.CUSTOM;
  }

  const match = (
    [FeePriority.LOW, FeePriority.MEDIUM, FeePriority.HIGH] as const
  ).find((priority) => fee.isEqualTo(new BigNumber(presets[priority])));

  return match ?? FeePriority.CUSTOM;
};
