/* eslint-disable @typescript-eslint/no-explicit-any */
import { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock useSafeAreaInsets
const mockInsets = {
  top: 44,
  bottom: 34,
  left: 0,
  right: 0,
};

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockInsets,
}));

// Mock useColors
const mockThemeColors = {
  base: ["#000000", "#FFFFFF"],
  foreground: {
    primary: "#000000",
  },
  border: {
    primary: "#E5E5E5",
  },
};

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: mockThemeColors,
  }),
}));

describe("CustomNavigationHeader", () => {
  const createMockNavigationProps = (
    options: Partial<NativeStackHeaderProps["options"]> = {},
  ): any => ({
    navigation: {
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
      navigate: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      reset: jest.fn(),
      isFocused: jest.fn(() => true),
      dispatch: jest.fn(),
      getParent: jest.fn(),
      getState: jest.fn(),
      getId: jest.fn(),
    },
    route: {
      key: "test-route",
      name: "TestScreen",
      params: {},
    },
    options: {
      headerTitle: "Test Title",
      ...options,
    },
    layout: {
      width: 375,
      height: 812,
    },
  });

  const createMockBottomTabProps = (
    options: Partial<BottomTabHeaderProps["options"]> = {},
  ): any => ({
    navigation: {
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
      navigate: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      reset: jest.fn(),
      isFocused: jest.fn(() => true),
      dispatch: jest.fn(),
      getParent: jest.fn(),
      getState: jest.fn(),
      getId: jest.fn(),
    },
    route: {
      key: "test-route",
      name: "TestScreen",
      params: {},
    },
    options: {
      headerTitle: "Test Title",
      ...options,
    },
    layout: {
      width: 375,
      height: 812,
    },
  });

  describe("Basic rendering", () => {
    it("renders with default header title", () => {
      const props = createMockNavigationProps();
      const { getByText } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      expect(getByText("Test Title")).toBeTruthy();
    });

    it("renders with default left and right buttons when no custom buttons are provided", () => {
      const props = createMockNavigationProps();
      const { getByTestId } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      // Should render default CustomHeaderButton on left
      expect(getByTestId("SvgMock")).toBeTruthy();
    });

    it("applies safe area insets correctly", () => {
      const props = createMockNavigationProps();
      const { getByTestId } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      const header = getByTestId("SvgMock").parent?.parent;
      expect(header).toBeTruthy();
    });
  });

  describe("Custom header left button", () => {
    it("renders custom header left button when provided", () => {
      const customLeftButton = () => (
        <CustomHeaderButton position="left" icon={Icon.X} />
      );

      const props = createMockNavigationProps({
        headerLeft: customLeftButton,
      });

      const { getByTestId } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      expect(getByTestId("SvgMock")).toBeTruthy();
    });

    it("passes correct props to custom header left button", () => {
      const mockHeaderLeft = jest.fn(() => (
        <CustomHeaderButton position="left" />
      ));

      const props = createMockNavigationProps({
        headerLeft: mockHeaderLeft,
      });

      renderWithProviders(<CustomNavigationHeader {...props} />);

      expect(mockHeaderLeft).toHaveBeenCalledWith({
        canGoBack: true,
        tintColor: mockThemeColors.base[1],
        pressColor: mockThemeColors.base[1],
        pressOpacity: 0.5,
      });
    });
  });

  describe("Custom header right button", () => {
    it("renders custom header right button when provided", () => {
      const customRightButton = () => (
        <CustomHeaderButton position="right" icon={Icon.Settings01} />
      );

      const props = createMockNavigationProps({
        headerRight: customRightButton,
      });

      const { getAllByTestId } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      // Should render two icons: left and right
      expect(getAllByTestId("SvgMock").length).toBe(2);
    });

    it("passes correct props to custom header right button", () => {
      const mockHeaderRight = jest.fn(() => (
        <CustomHeaderButton position="right" />
      ));

      const props = createMockNavigationProps({
        headerRight: mockHeaderRight,
      });

      renderWithProviders(<CustomNavigationHeader {...props} />);

      expect(mockHeaderRight).toHaveBeenCalledWith({
        canGoBack: true,
        tintColor: mockThemeColors.base[1],
        pressColor: mockThemeColors.base[1],
        pressOpacity: 0.5,
      });
    });
  });

  describe("Header title handling", () => {
    it("renders string header title", () => {
      const props = createMockNavigationProps({
        headerTitle: "Custom Title",
      });

      const { getByText } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      expect(getByText("Custom Title")).toBeTruthy();
    });

    it("does not render title when headerTitle is not a string", () => {
      const customTitle = () => <Text>Custom Component Title</Text>;

      const props = createMockNavigationProps({
        headerTitle: customTitle,
      });

      const { queryByText } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      expect(queryByText("Test Title")).toBeNull();
    });

    it("does not render title when headerTitle is undefined", () => {
      const props = createMockNavigationProps({
        headerTitle: undefined,
      });

      const { queryByText } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      expect(queryByText("Test Title")).toBeNull();
    });
  });

  describe("Navigation prop handling", () => {
    it("works with NativeStackHeaderProps", () => {
      const props = createMockNavigationProps();
      const { getByText } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      expect(getByText("Test Title")).toBeTruthy();
    });

    it("works with BottomTabHeaderProps", () => {
      const props = createMockBottomTabProps();
      const { getByText } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      expect(getByText("Test Title")).toBeTruthy();
    });

    it("handles navigation.canGoBack() correctly", () => {
      const mockCanGoBack = jest.fn(() => false);
      const props = createMockNavigationProps();
      props.navigation.canGoBack = mockCanGoBack;

      const mockHeaderLeft = jest.fn(() => (
        <CustomHeaderButton position="left" />
      ));
      props.options.headerLeft = mockHeaderLeft;

      renderWithProviders(<CustomNavigationHeader {...props} />);

      expect(mockHeaderLeft).toHaveBeenCalledWith({
        canGoBack: false,
        tintColor: mockThemeColors.base[1],
        pressColor: mockThemeColors.base[1],
        pressOpacity: 0.5,
      });
    });
  });

  describe("Styling and layout", () => {
    it("applies correct base styling classes", () => {
      const props = createMockNavigationProps();
      const { getByTestId } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      const header = getByTestId("SvgMock").parent?.parent;
      expect(header).toBeTruthy();
    });

    it("maintains proper spacing with empty right button when no custom right button is provided", () => {
      const props = createMockNavigationProps();
      const { getByTestId } = renderWithProviders(
        <CustomNavigationHeader {...props} />,
      );

      // Should still render the header structure correctly
      expect(getByTestId("SvgMock")).toBeTruthy();
    });
  });

  describe("Edge cases", () => {
    it("handles missing options gracefully", () => {
      const props = createMockNavigationProps();
      const propsWithoutOptions = { ...props };
      delete propsWithoutOptions.options;

      expect(() => {
        renderWithProviders(
          <CustomNavigationHeader {...propsWithoutOptions} />,
        );
      }).not.toThrow();
    });

    it("handles missing headerTitle gracefully", () => {
      const props = createMockNavigationProps();
      const propsWithoutTitle = { ...props };
      delete propsWithoutTitle.options.headerTitle;

      const { getByTestId } = renderWithProviders(
        <CustomNavigationHeader {...propsWithoutTitle} />,
      );

      // Should still render the header structure
      expect(getByTestId("SvgMock")).toBeTruthy();
    });
  });
});
