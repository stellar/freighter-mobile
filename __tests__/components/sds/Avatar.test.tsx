/**
 * @jest-environment jsdom
 */
import { Avatar, AvatarSize } from "components/sds/Avatar";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

/* eslint-disable */
// Mock the Skia canvas functionality with proper React components
jest.mock("@shopify/react-native-skia", () => {
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
/* eslint-enable */

const TEST_PUBLIC_ADDRESS =
  "GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST5TVOM";
const TEST_USER_NAME = "John Doe";

describe("Avatar", () => {
  describe("Size handling", () => {
    const sizes: AvatarSize[] = ["sm", "md", "lg"];

    it.each(sizes)("renders with correct size: %s", (size) => {
      const { getByTestId } = renderWithProviders(
        <Avatar size={size} testID={`avatar-${size}`} />,
      );

      const avatar = getByTestId(`avatar-${size}`);
      expect(avatar).toBeDefined();
    });

    it("renders default icon with all sizes", () => {
      sizes.forEach((size) => {
        const { getByTestId } = renderWithProviders(
          <Avatar size={size} testID={`default-${size}`} />,
        );

        const avatar = getByTestId(`default-${size}`);
        expect(avatar).toBeDefined();
      });
    });
  });

  describe("Avatar variations", () => {
    it("renders with Stellar address", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar
          size="md"
          publicAddress={TEST_PUBLIC_ADDRESS}
          testID="stellar-avatar"
        />,
      );

      const avatar = getByTestId("stellar-avatar");
      expect(avatar).toBeDefined();

      expect(avatar).toHaveStyle({ backgroundColor: "#161616" });
    });

    it("renders with user name (initials)", () => {
      const { getByTestId, getByText } = renderWithProviders(
        <Avatar size="md" userName={TEST_USER_NAME} testID="initials-avatar" />,
      );

      const avatar = getByTestId("initials-avatar");
      expect(avatar).toBeDefined();

      const initials = getByText("JD");
      expect(initials).toBeDefined();
    });

    it("renders default icon when no publicAddress or userName provided", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar size="md" testID="default-avatar" />,
      );

      const avatar = getByTestId("default-avatar");
      expect(avatar).toBeDefined();

      const icon = getByTestId("SvgMock");
      expect(icon).toBeDefined();
    });
  });

  describe("Initials generation", () => {
    it("renders first letter of single name", () => {
      const { getByText } = renderWithProviders(
        <Avatar size="md" userName="John" testID="single-name-avatar" />,
      );

      const initial = getByText("J");
      expect(initial).toBeDefined();
    });

    it("renders first letters of first and last name", () => {
      const { getByText } = renderWithProviders(
        <Avatar size="md" userName="John Doe" testID="double-name-avatar" />,
      );

      const initials = getByText("JD");
      expect(initials).toBeDefined();
    });
  });

  describe("Stellar identicon rendering", () => {
    it("generates correct identicon for a Stellar address", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar
          size="md"
          publicAddress={TEST_PUBLIC_ADDRESS}
          testID="identicon-avatar"
        />,
      );

      const avatar = getByTestId("identicon-avatar");
      expect(avatar).toBeDefined();

      expect(avatar).toHaveStyle({ backgroundColor: "#161616" });
    });

    it("renders different identicons for different addresses", () => {
      const address1 = TEST_PUBLIC_ADDRESS;
      const address2 =
        "GBUZ6T3M2XSCQPXDEPINQJZQZZNZZBYFRJ6QTIGWKPMI7JAJQNWU7YHE";

      const { getAllByTestId } = renderWithProviders(
        <>
          <Avatar size="md" publicAddress={address1} testID="identicon-test" />
          <Avatar size="md" publicAddress={address2} testID="identicon-test" />
        </>,
      );

      const avatars = getAllByTestId("identicon-test");
      expect(avatars).toHaveLength(2);

      avatars.forEach((avatar) => {
        expect(avatar).toHaveStyle({ backgroundColor: "#161616" });
      });
    });
  });

  describe("Accessibility", () => {
    it("passes testID to the container", () => {
      const { getByTestId } = renderWithProviders(
        <Avatar size="md" testID="test-id-avatar" />,
      );

      const avatar = getByTestId("test-id-avatar");
      expect(avatar).toBeDefined();
    });
  });
});
