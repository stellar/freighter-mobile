import { renderHook } from "@testing-library/react-native";
import PriceHistoryNotice, {
  iconOffsetFromFirstLine,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/PriceHistoryNotice";
import { renderWithProviders } from "helpers/testUtils";
import en from "i18n/locales/en/translations.json";
import pt from "i18n/locales/pt/translations.json";
import React from "react";
import { StyleSheet, useWindowDimensions } from "react-native";

/**
 * The card is an icon and a title on one row, with the sentence beneath.
 * React Native defaults `flexShrink` to 0, so a title that does not opt into
 * shrinking runs past the card's padding rather than wrapping inside it —
 * and these titles are long. Portuguese `verdictUnavailable` is 52
 * characters, and any of them grow with the OS text-size setting.
 */
describe("PriceHistoryNotice", () => {
  it("lets the title wrap rather than overflow the card", () => {
    const { getByText } = renderWithProviders(
      <PriceHistoryNotice variant="verdictUnavailable" />,
    );

    const title = getByText(en.priceHistory.notice.verdictUnavailable.title);

    // Flattened: styled-components contributes the type styles as the first
    // entry and the inline rule as the second.
    expect(StyleSheet.flatten(title.props.style)).toEqual(
      expect.objectContaining({ flex: 1 }),
    );
  });

  it("has a title long enough for that to matter", () => {
    // Guards the premise. If these were ever shortened to something that fits
    // on one line everywhere, the wrap rule would be untested rather than
    // unnecessary, and the next long translation would overflow silently.
    expect(
      pt.priceHistory.notice.verdictUnavailable.title.length,
    ).toBeGreaterThan(40);
  });
});

describe("PriceHistoryNotice icon alignment", () => {
  it("aligns the row to the top, which the offset then corrects for", () => {
    // The padding only makes sense with `items-start`. Left on `items-center`
    // the row already centres the icon and the padding pushes it BELOW
    // centre — 3pt low at default text, ~14pt at double, i.e. clear of the
    // text box and worse than the bug being fixed.
    const { getByTestId } = renderWithProviders(
      <PriceHistoryNotice variant="verdictUnavailable" />,
    );

    const row = getByTestId("price-history-notice-heading");

    expect(row.props.className).toMatch(/items-start/);
    expect(row.props.className).not.toMatch(/items-center/);
  });

  it("binds the LIVE text scale into the icon's offset", () => {
    // The pure function being right is not enough: the component has to pass
    // the live scale. Passing a literal 1, or dropping the wrapper entirely
    // and going back to the misalignment this fixes, is invisible to a test
    // that only exercises the function.
    const { getByTestId } = renderWithProviders(
      <PriceHistoryNotice variant="verdictUnavailable" />,
    );
    const { fontScale } = renderHook(() => useWindowDimensions()).result
      .current;

    expect(Number.isFinite(fontScale)).toBe(true);
    expect(
      StyleSheet.flatten(getByTestId("price-history-notice-icon").props.style)
        .paddingTop,
    ).toBe(iconOffsetFromFirstLine(fontScale));
  });
});

describe("iconOffsetFromFirstLine", () => {
  it("re-centres the icon as the title's line box grows", () => {
    // `items-start` is needed so a wrapped title does not float the icon
    // against the middle of two lines — but it then pins the icon to the top,
    // so the offset has to put it back on the first line's centre. The icon
    // is device-scaled only while the text also scales with the OS setting,
    // so a fixed offset is right at exactly one text size.
    const atDefault = iconOffsetFromFirstLine(1);
    const atLargeText = iconOffsetFromFirstLine(2);

    expect(atLargeText).toBeGreaterThan(atDefault);
  });

  it("never pulls the icon above the row", () => {
    // A scale small enough to make the line box shorter than the icon would
    // otherwise produce a negative padding.
    expect(iconOffsetFromFirstLine(0.1)).toBe(0);
  });
});
