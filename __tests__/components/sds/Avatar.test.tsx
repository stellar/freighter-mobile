/**
 * @jest-environment jsdom
 */
import { Avatar, AvatarSizes } from "components/sds/Avatar";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

/* eslint-disable */
// Mock the Skia canvas functionality with proper React components
jest.doMock("@shopify/react-native-skia", () => {
  const React = require("react");

  // Create mock components that actually render
  const createMockComponent =
    (name: string) =>
    ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: any;
    }) =>
      React.createElement(
        "div",
        {
          "data-testid": `skia-${name.toLowerCase()}`,
          ...props,
        },
        children,
      );

  return {
    Canvas: createMockComponent("Canvas"),
    Rect: createMockComponent("Rect"),
    Paint: createMockComponent("Paint"),
    Fill: createMockComponent("Fill"),
    Group: createMockComponent("Group"),
    Circle: createMockComponent("Circle"),
    Path: createMockComponent("Path"),
    Skia: {
      Path: {
        Make: jest.fn(),
      },
    },
    useValue: jest.fn(() => ({ current: 0 })),
  };
});

// Mock the useColors hook
jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      base: ["#000000", "#FFFFFF"],
      text: {
        secondary: "#666666",
      },
    },
  }),
}));
/* eslint-enable */

const TEST_PUBLIC_ADDRESS =
  "GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST5TVOM";
const TEST_USER_NAME = "John Doe";

describe("Avatar", () => {
  describe("Size handling", () => {
    const sizes = [
      AvatarSizes.SMALL,
      AvatarSizes.MEDIUM,
      AvatarSizes.LARGE,
      AvatarSizes.EXTRA_LARGE,
    ];
    const sizeClasses = {
      [AvatarSizes.SMALL]: "w-[26px] h-[26px]",
      [AvatarSizes.MEDIUM]: "w-[38px] h-[38px]",
      [AvatarSizes.LARGE]: "w-[40px] h-[40px]",
      [AvatarSizes.EXTRA_LARGE]: "w-[50px] h-[50px]",
    };

    it.each(sizes)("renders with correct size class: %s", (size) => {
      const { getByTestId } = renderWithProviders(
        <Avatar size={size} testID={`avatar-${size}`} />,
      );

      const avatar = getByTestId(`avatar-${size}`);
      expect(avatar.props.className).toContain(sizeClasses[size]);
    });

    it("renders default icon with all sizes", () => {
      sizes.forEach((size) => {
        const { getByTestId } = renderWithProviders(
          <Avatar size={size} testID={`default-${size}`} />,
        );

        const avatar = getByTestId(`default-${size}`);
        expect(avatar.props.className).toContain(sizeClasses[size]);
        expect(avatar.props.className).toContain("rounded-full");
      });
    });
  });

  describe("Avatar variations", () => {
    it("renders with Stellar address", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar
          size={AvatarSizes.MEDIUM}
          publicAddress={TEST_PUBLIC_ADDRESS}
          testID="stellar-avatar"
        />,
      );

      const avatar = getByTestId("stellar-avatar");
      expect(avatar.props.className).toContain("bg-background-primary");
      expect(avatar.props.className).toContain("border-border-primary");
      expect(avatar.props.className).toContain("rounded-full");
    });

    it("renders with user name (initials)", () => {
      const { getByTestId, getByText } = renderWithProviders(
        <Avatar
          size={AvatarSizes.MEDIUM}
          userName={TEST_USER_NAME}
          testID="initials-avatar"
        />,
      );

      const avatar = getByTestId("initials-avatar");
      expect(avatar.props.className).toContain("bg-background-primary");
      expect(avatar.props.className).toContain("border-border-primary");

      const initials = getByText("JD");
      expect(initials.props.style).toEqual(
        expect.objectContaining({ fontWeight: "700", color: "#a0a0a0" }),
      );
    });

    it("renders default icon when no publicAddress or userName provided", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar size={AvatarSizes.MEDIUM} testID="default-avatar" />,
      );

      const avatar = getByTestId("default-avatar");
      expect(avatar.props.className).toContain("bg-background-primary");
      expect(avatar.props.className).toContain("border-border-primary");
      expect(avatar.props.className).toContain("rounded-full");

      const icon = getByTestId("SvgMock");
      expect(icon).toBeDefined();
    });
  });

  describe("Selection indicator", () => {
    it("does not show indicator by default", () => {
      const { queryByTestId } = renderWithProviders(
        <Avatar size={AvatarSizes.MEDIUM} testID="avatar" />,
      );

      expect(queryByTestId("avatar-indicator")).toBeNull();
    });

    it("shows indicator when isSelected is true", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar size={AvatarSizes.MEDIUM} isSelected testID="avatar" />,
      );

      const indicator = getByTestId("avatar-indicator");
      expect(indicator.props.className).toContain("absolute");
      expect(indicator.props.className).toContain("-bottom-1");
      expect(indicator.props.className).toContain("bg-primary");
      expect(indicator.props.className).toContain("justify-center");
      expect(indicator.props.className).toContain("items-center");

      // Check icon should be present
      const checkIcon = indicator.findByProps({ testID: "SvgMock" });
      expect(checkIcon).toBeDefined();
    });

    it("shows indicator with correct size based on avatar size", () => {
      const sizes = [AvatarSizes.SMALL, AvatarSizes.MEDIUM, AvatarSizes.LARGE];
      const indicatorSizes = {
        [AvatarSizes.SMALL]: "w-3 h-3",
        [AvatarSizes.MEDIUM]: "w-4 h-4",
        [AvatarSizes.LARGE]: "w-5 h-5",
      };

      sizes.forEach((size) => {
        const { getByTestId } = renderWithProviders(
          <Avatar size={size} isSelected testID={`avatar-${size}`} />,
        );

        const indicator = getByTestId(`avatar-${size}-indicator`);
        expect(indicator.props.className).toContain(indicatorSizes[size]);
      });
    });

    it("shows indicator for all avatar types", () => {
      const { getAllByTestId } = renderWithProviders(
        <>
          <Avatar
            size={AvatarSizes.MEDIUM}
            isSelected
            testID="default-avatar"
          />
          <Avatar
            size={AvatarSizes.MEDIUM}
            userName="John Doe"
            isSelected
            testID="initials-avatar"
          />
          <Avatar
            size={AvatarSizes.MEDIUM}
            publicAddress={TEST_PUBLIC_ADDRESS}
            isSelected
            testID="identicon-avatar"
          />
        </>,
      );

      const indicators = getAllByTestId(/-indicator$/);
      expect(indicators).toHaveLength(3);
      indicators.forEach((indicator) => {
        expect(indicator.props.className).toContain("bg-primary");
        expect(indicator.props.className).toContain("justify-center");
        expect(indicator.props.className).toContain("items-center");

        // Each indicator should have a check icon
        const checkIcon = indicator.findByProps({ testID: "SvgMock" });
        expect(checkIcon).toBeDefined();
      });
    });
  });

  describe("Border handling", () => {
    it("renders with border by default", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar size={AvatarSizes.MEDIUM} testID="border-avatar" />,
      );

      const avatar = getByTestId("border-avatar");
      expect(avatar.props.className).toContain("border");
      expect(avatar.props.className).toContain("border-border-primary");
    });

    it("renders without border when hasBorder is false", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar
          size={AvatarSizes.MEDIUM}
          hasBorder={false}
          testID="no-border-avatar"
        />,
      );

      const avatar = getByTestId("no-border-avatar");
      expect(avatar.props.className).not.toContain("border");
      expect(avatar.props.className).not.toContain("border-border-primary");
    });
  });

  describe("Accessibility", () => {
    it("passes testID to the container", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar size={AvatarSizes.MEDIUM} testID="test-id-avatar" />,
      );

      const avatar = getByTestId("test-id-avatar");
      expect(avatar).toBeDefined();
    });
  });
});
