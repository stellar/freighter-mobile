import { Display } from "components/sds/Typography";
import React from "react";
import { Text as RNText, View } from "react-native";

/**
 * Finds matching characters between raw input and formatted display.
 * Returns an object with matching characters and non-matching decimals.
 */
const findMatchingCharacters = (
  rawInput: string,
  formattedDisplay: string,
): {
  matches: Array<{ char: string; isMatch: boolean }>;
  nonMatchingDecimals: string;
} => {
  const matches: Array<{ char: string; isMatch: boolean }> = [];
  const rawChars = rawInput.split("");
  const formattedChars = formattedDisplay.split("");

  // Remove $ prefix from formatted display for comparison
  let formattedStartIndex = 0;
  if (formattedDisplay.startsWith("$")) {
    formattedStartIndex = 1;
    // Add $ as non-matching since it's not in raw input
    matches.push({ char: "$", isMatch: false });
  }

  let rawIndex = 0;
  let formattedIndex = formattedStartIndex;

  // Find decimal separator position in formatted display to distinguish grouping vs decimal separators
  let decimalSeparatorIndex = -1;
  for (let i = formattedStartIndex; i < formattedChars.length; i++) {
    const char = formattedChars[i];
    // Decimal separator is followed by exactly 2 digits
    if (
      (char === "," || char === ".") &&
      i < formattedChars.length - 2 &&
      /\d/.test(formattedChars[i + 1]) &&
      /\d/.test(formattedChars[i + 2]) &&
      (i === formattedChars.length - 3 || !/\d/.test(formattedChars[i + 3]))
    ) {
      decimalSeparatorIndex = i;
      break;
    }
  }

  // Match raw input characters against formatted display
  while (rawIndex < rawChars.length && formattedIndex < formattedChars.length) {
    const rawChar = rawChars[rawIndex];
    const formattedChar = formattedChars[formattedIndex];

    // Skip grouping separators (commas/dots that are not the decimal separator)
    const isGroupingSeparator =
      (formattedChar === "," || formattedChar === ".") &&
      formattedIndex !== decimalSeparatorIndex;

    if (isGroupingSeparator) {
      matches.push({ char: formattedChar, isMatch: false });
      formattedIndex++;
    } else if (rawChar === formattedChar) {
      // Direct character match
      matches.push({ char: formattedChar, isMatch: true });
      rawIndex++;
      formattedIndex++;
    } else {
      // Handle decimal separator: both can be comma or dot
      const isRawDecimalSeparator = rawChar === "," || rawChar === ".";
      const isFormattedDecimalSeparator =
        formattedChar === "," || formattedChar === ".";

      if (isRawDecimalSeparator && isFormattedDecimalSeparator) {
        matches.push({ char: formattedChar, isMatch: true });
        rawIndex++;
        formattedIndex++;
      } else if (!isRawDecimalSeparator) {
        // If formatted has a character that doesn't match raw, skip it (it's formatting)
        matches.push({ char: formattedChar, isMatch: false });
        formattedIndex++;
      } else if (isRawDecimalSeparator) {
        // If raw has a decimal separator but formatted doesn't match, skip formatted
        formattedIndex++;
      }
    }
  }

  // Get remaining formatted characters (non-matching decimals like ",00")
  const nonMatchingDecimals =
    formattedIndex < formattedChars.length
      ? formattedDisplay.substring(formattedIndex)
      : "";

  return { matches, nonMatchingDecimals };
};

interface HighlightedAmountDisplayProps {
  rawInput: string | null;
  formattedDisplay: string;
  isSmallScreen: boolean;
  highlightColor: string;
  normalColor: string;
  secondaryColor: string;
}

/**
 * Component that renders text with highlighted matching characters.
 * Highlights characters in the raw input that match the formatted display.
 * Includes both the background display and the overlay with highlighted characters.
 */
export const HighlightedAmountDisplay: React.FC<
  HighlightedAmountDisplayProps
> = ({
  rawInput,
  formattedDisplay,
  isSmallScreen,
  highlightColor,
  normalColor,
  secondaryColor,
}) => {
  const { matches, nonMatchingDecimals } = findMatchingCharacters(
    rawInput || "",
    formattedDisplay,
  );

  // Calculate the starting index for non-matching decimals to create unique keys
  const nonMatchingStartIndex =
    formattedDisplay.length - nonMatchingDecimals.length;

  return (
    <View className="relative items-center justify-center">
      {/* Background display - only shown when rawInput is empty, hidden when user starts typing to avoid overlapping with the overlay */}
      <Display
        size={isSmallScreen ? "lg" : "xl"}
        medium
        adjustsFontSizeToFit
        numberOfLines={1}
        minimumFontScale={0.6}
        secondary
        style={{ opacity: rawInput ? 0 : 1 }}
      >
        {formattedDisplay}
      </Display>
      {/* Overlay with highlighted characters - only shown when rawInput exists */}
      {rawInput && (
        <View
          className="absolute inset-0 items-center justify-center"
          pointerEvents="none"
        >
          <Display
            size={isSmallScreen ? "lg" : "xl"}
            medium
            adjustsFontSizeToFit
            numberOfLines={1}
            minimumFontScale={0.6}
          >
            {matches.map((item, index) => {
              const uniqueKey = `match-${index}-${item.char}-${item.isMatch}`;
              return (
                <RNText
                  key={uniqueKey}
                  style={{
                    color: item.isMatch ? highlightColor : normalColor,
                  }}
                >
                  {item.char}
                </RNText>
              );
            })}
            {nonMatchingDecimals.split("").map((char, index) => {
              const uniqueKey = `non-matching-${nonMatchingStartIndex + index}-${char}`;
              return (
                <RNText
                  key={uniqueKey}
                  style={{
                    color: secondaryColor,
                  }}
                >
                  {char}
                </RNText>
              );
            })}
          </Display>
        </View>
      )}
    </View>
  );
};
