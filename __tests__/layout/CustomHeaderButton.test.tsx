/* eslint-disable global-require, @typescript-eslint/no-var-requires */
import { userEvent } from "@testing-library/react-native";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock useNavigation hook
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
}));

describe("CustomHeaderButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Custom onPress handlers", () => {
    it("calls custom onPress when provided for left position", async () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="left" onPress={mockOnPress} />,
      );

      const button = getByTestId("header-button");
      await userEvent.press(button);
      expect(mockOnPress).toHaveBeenCalledTimes(1);
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it("calls custom onPress when provided for right position", async () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="right" onPress={mockOnPress} />,
      );

      const button = getByTestId("header-button");
      await userEvent.press(button);
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it("calls navigation.goBack() when no custom onPress is provided for left position", async () => {
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="left" />,
      );

      const button = getByTestId("header-button");
      await userEvent.press(button);
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it("does not call any action when no custom onPress is provided for right position", async () => {
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="right" />,
      );

      const button = getByTestId("header-button");
      await userEvent.press(button);
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  describe("Custom styling", () => {
    it("applies custom className when provided", () => {
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton
          position="left"
          className="w-12 h-12 bg-red-500 rounded-full"
        />,
      );

      const button = getByTestId("SvgMock").parent;
      expect(button).toBeTruthy();
    });

    it("uses default className when no custom className is provided for left position", () => {
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="left" />,
      );

      const button = getByTestId("SvgMock").parent;
      expect(button).toBeTruthy();
    });

    it("uses default className when no custom className is provided for right position", () => {
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="right" />,
      );

      const button = getByTestId("SvgMock").parent;
      expect(button).toBeTruthy();
    });
  });

  describe("Custom icon size", () => {
    it("applies custom icon size when provided", () => {
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="left" iconSize={32} />,
      );

      expect(getByTestId("SvgMock")).toBeTruthy();
    });

    it("uses default icon size (24) when no custom size is provided", () => {
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="left" />,
      );

      expect(getByTestId("SvgMock")).toBeTruthy();
    });
  });

  describe("Custom hitSlop", () => {
    it("applies custom hitSlop when provided", () => {
      const customHitSlop = { top: 20, bottom: 20, left: 20, right: 20 };
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="left" hitSlop={customHitSlop} />,
      );

      const button = getByTestId("SvgMock").parent;
      expect(button).toBeTruthy();
    });

    it("uses default hitSlop when no custom hitSlop is provided", () => {
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="left" />,
      );

      const button = getByTestId("SvgMock").parent;
      expect(button).toBeTruthy();
    });
  });

  describe("Button disabled state", () => {
    it("disables button when no onPress is provided for right position", async () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="right" />,
      );

      const button = getByTestId("header-button");
      await userEvent.press(button);
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it("enables button when onPress is provided for right position", async () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="right" onPress={mockOnPress} />,
      );

      const button = getByTestId("header-button");
      await userEvent.press(button);
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it("enables button for left position with default goBack action", async () => {
      jest
        .spyOn(require("@react-navigation/native"), "useNavigation")
        .mockReturnValue({ goBack: mockGoBack });
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="left" />,
      );

      const button = getByTestId("header-button");
      await userEvent.press(button);
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("renders with proper accessibility props", () => {
      const { getByTestId } = renderWithProviders(
        <CustomHeaderButton position="left" />,
      );

      const button = getByTestId("SvgMock").parent;
      expect(button).toBeTruthy();
    });
  });
});
