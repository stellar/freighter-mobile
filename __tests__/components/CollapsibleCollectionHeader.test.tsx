import { fireEvent, render, screen } from "@testing-library/react-native";
import ChevronSvg from "assets/icons/chevron-down.svg";
import { CollapsibleCollectionHeader } from "components/CollapsibleCollectionHeader";
import Icon from "components/sds/Icon";
import { getThemeColors } from "config/colors";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { px } from "helpers/dimensions";
import { hostParentOf } from "helpers/testUtils";
import React from "react";
import { StyleSheet } from "react-native";

type HeaderProps = React.ComponentProps<typeof CollapsibleCollectionHeader>;

// Jest reports no device scheme, so useColors resolves DEFAULT_COLOR_SCHEME.
const { gray } = getThemeColors(DEFAULT_COLOR_SCHEME);

const header = (props: Partial<HeaderProps> = {}) => (
  <CollapsibleCollectionHeader
    collectionName="Soroban Frogs"
    count={7}
    isExpanded
    onToggle={jest.fn()}
    testID="header"
    {...props}
  />
);

const renderHeader = (props: Partial<HeaderProps> = {}) =>
  render(header(props));

const countBadge = (count = "7") => hostParentOf(screen.getByText(count));

// The view around the chevron, and the row that holds it next to the badge.
const chevronBox = () => hostParentOf(screen.getByTestId("SvgMock"));
const badgeAndChevronRow = () => {
  const box = chevronBox();
  return box ? hostParentOf(box) : null;
};

describe("CollapsibleCollectionHeader", () => {
  describe("count badge", () => {
    // A single digit used to get a fixed 24pt circle and two or more a 24pt
    // pill, so both are checked: neither keeps a fixed height or width.
    it.each([[3], [12]])(
      "sizes the count badge to its text (count %i)",
      (count) => {
        renderHeader({ count });

        // NativeWind doesn't apply classes in tests, so the padding is read
        // off the class names. It is 7pt by 1pt, not Figma's 8pt by 2pt:
        // Figma draws the 1pt stroke inside a 24pt-tall badge (20pt of text
        // and 2pt of padding), and a border adds to the box here, so the
        // border takes the last point.
        const { className } = countBadge(String(count))?.props ?? {};

        expect(className).toContain("px-[7px]");
        expect(className).toContain("py-[1px]");
        expect(className).not.toContain("h-[24px]");
        expect(className).not.toContain("w-[24px]");
      },
    );

    it("shows the count in Text/SM/600 at a 20pt line height", () => {
      renderHeader();

      // Text's `sm` is 14/22; Figma's Text/SM is 14/20.
      expect(
        StyleSheet.flatten(screen.getByText("7").props.style),
      ).toMatchObject({ fontSize: 14, fontWeight: "600", lineHeight: 20 });
    });

    it("keeps the badge a bordered pill filled Gray/3, with its count in Gray/11", () => {
      renderHeader();

      expect(countBadge()?.props.className.split(" ")).toEqual(
        expect.arrayContaining([
          "rounded-full",
          "border",
          "bg-gray-3",
          "border-gray-6",
        ]),
      );
      expect(
        StyleSheet.flatten(screen.getByText("7").props.style),
      ).toMatchObject({ color: gray[11] });
    });
  });

  describe("chevron", () => {
    it.each([
      ["expanded", true],
      ["collapsed", false],
    ])(
      "draws a 12pt chevron with a 1.5pt stroke in Gray/9 when %s",
      (_state, isExpanded) => {
        renderHeader({ isExpanded });

        // Every .svg is the same mock in Jest, and the mock turns a string
        // width into NaN, so the size is read off the svg's own props.
        const chevron = screen.UNSAFE_getByType(ChevronSvg);

        expect(chevron.props.width).toBe(px(12));
        expect(chevron.props.height).toBe(px(12));
        // Icon turns points into the 24-unit grid: 1.5 × 24 / 12.
        expect(chevron.props.strokeWidth).toBe(3);
        expect(chevron.props.color).toBe(gray[9]);
      },
    );

    it("points the chevron up while expanded and down while collapsed", () => {
      const { rerender } = renderHeader({ isExpanded: true });

      expect(screen.UNSAFE_queryByType(Icon.ChevronUp)).not.toBeNull();
      expect(screen.UNSAFE_queryByType(Icon.ChevronDown)).toBeNull();

      rerender(header({ isExpanded: false }));

      expect(screen.UNSAFE_queryByType(Icon.ChevronUp)).toBeNull();
      expect(screen.UNSAFE_queryByType(Icon.ChevronDown)).not.toBeNull();
    });

    it("boxes the chevron 28pt tall", () => {
      renderHeader();

      expect(StyleSheet.flatten(chevronBox()?.props.style)).toMatchObject({
        height: 28,
      });
    });

    it("pads the chevron 8pt at each side", () => {
      renderHeader();

      expect(StyleSheet.flatten(chevronBox()?.props.style)).toMatchObject({
        paddingHorizontal: 8,
      });
    });

    it("sets the chevron's box 8pt from the badge", () => {
      renderHeader();

      // An arbitrary value: `gap-2` would be 7pt, with NativeWind's rem at 14.
      expect(badgeAndChevronRow()?.props.className).toContain("gap-[8px]");
    });
  });

  describe("row", () => {
    it("is a button labelled with the name and count, and exposes its expanded state", () => {
      const { rerender } = renderHeader({ isExpanded: true });

      expect(screen.getByTestId("header").props).toMatchObject({
        accessibilityRole: "button",
        accessibilityLabel: "Soroban Frogs, 7",
        accessibilityState: { expanded: true },
      });

      rerender(header({ isExpanded: false }));

      expect(screen.getByTestId("header").props.accessibilityState).toEqual({
        expanded: false,
      });
    });

    it("toggles when pressed", () => {
      const onToggle = jest.fn();
      renderHeader({ onToggle });

      fireEvent.press(screen.getByTestId("header"));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("draws the divider between the name and the badge only when asked", () => {
      const { rerender } = renderHeader();
      expect(screen.queryByTestId("collection-header-divider")).toBeNull();

      rerender(header({ showDivider: true }));
      expect(screen.getByTestId("collection-header-divider")).toBeTruthy();
    });
  });
});
