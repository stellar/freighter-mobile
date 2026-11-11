import { fsValue, pxValue } from "helpers/dimensions";
import React from "react";
import { View } from "react-native";

/** Figma pads a token row 12pt above and below its content. */
export const TOKEN_ROW_VERTICAL_PADDING = 12;

/** The icon a token row starts with: the SDS Token's `lg`, 40pt. */
export const TOKEN_ROW_ICON_SIZE = 40;

/**
 * The 16pt between a token row's columns: after the icon, and before the
 * right column.
 */
export const TOKEN_ROW_GAP = 16;

/**
 * Where a token row's text column starts: the icon plus the gap after it.
 * The divider under the row starts here too.
 */
export const TOKEN_ROW_TEXT_INSET = TOKEN_ROW_ICON_SIZE + TOKEN_ROW_GAP;

/**
 * Line height of a token row's second line (Figma Text/SM, 14/20). Rows set it
 * on the line itself, because `TEXT_SIZES.sm` stays 14/22 for the rest of the
 * app.
 */
export const TOKEN_ROW_SECONDARY_LINE_HEIGHT = 20;

/**
 * A token row's second line (the amount, the 24h change): 2pt under the
 * first, in that 20pt line height.
 */
export const TOKEN_ROW_SECONDARY_LINE_STYLE = {
  marginTop: pxValue(2),
  lineHeight: fsValue(TOKEN_ROW_SECONDARY_LINE_HEIGHT),
};

interface TokenRowDividerProps {
  testID?: string;
}

/**
 * The 1pt line under a token row, inset to the text column so it doesn't run
 * under the token icon.
 */
export const TokenRowDivider: React.FC<TokenRowDividerProps> = ({
  testID = "token-row-divider",
}) => (
  <View
    testID={testID}
    className="h-[1px] bg-border-primary"
    style={{ marginLeft: pxValue(TOKEN_ROW_TEXT_INSET) }}
  />
);
