import { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader, {
  NavigationHeaderBar,
  getNavigationHeaderPaddingTop,
} from "components/layout/CustomNavigationHeader";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { StyleSheet } from "react-native";

// Mock useSafeAreaInsets: an iPhone 17 Pro's, tall enough that the row sits
// 8pt below it rather than at the 45dp minimum.
const mockInsets = {
  top: 62,
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
  text: {
    primary: "#171717",
  },
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

    it("renders with default left button when no custom buttons are provided", () => {
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

  describe("Varial geometry", () => {
    const headerStyle = (
      options: Partial<NativeStackHeaderProps["options"]> = {},
    ) =>
      StyleSheet.flatten(
        renderWithProviders(
          <CustomNavigationHeader {...createMockNavigationProps(options)} />,
        ).getByTestId("navigation-header").props.style,
      );

    it("starts the nav row 8pt below the safe-area top", () => {
      expect(headerStyle().paddingTop).toBe(mockInsets.top + 8);
    });

    it("keeps the row clear of the status bar when the device reports no top inset", () => {
      mockInsets.top = 0;
      try {
        expect(headerStyle().paddingTop).toBe(45);
      } finally {
        mockInsets.top = 62;
      }
    });

    // A short status bar, such as a Galaxy S22's 27dp or an iPhone SE's
    // 20pt, would leave the row crowding it; tall ones are unaffected.
    it("starts the row at least 45dp from the top of the screen", () => {
      expect(getNavigationHeaderPaddingTop(27)).toBe(45);
      expect(getNavigationHeaderPaddingTop(20)).toBe(45);
      expect(getNavigationHeaderPaddingTop(52)).toBe(60);
    });

    it("shares its row position, so other headers can line up with it", () => {
      expect(getNavigationHeaderPaddingTop(62)).toBe(70);
      expect(getNavigationHeaderPaddingTop(0)).toBe(45);
    });

    it("insets its buttons 16pt from the screen edges", () => {
      expect(headerStyle()).toMatchObject({ paddingHorizontal: 16 });
    });

    it("leaves 24pt under the row", () => {
      expect(headerStyle()).toMatchObject({ paddingBottom: 24 });
    });

    it("sets the title in Inter SemiBold 18/26, as Figma's Text/LG/600", () => {
      const { getByText } = renderWithProviders(
        <CustomNavigationHeader {...createMockNavigationProps()} />,
      );

      expect(
        StyleSheet.flatten(getByText("Test Title").props.style),
      ).toMatchObject({
        fontFamily: "Inter-Variable",
        fontWeight: "600",
        fontSize: 18,
        lineHeight: 26,
      });
    });

    it("keeps the title centered with a spacer as large as the button", () => {
      const { getByTestId } = renderWithProviders(
        <CustomNavigationHeader {...createMockNavigationProps()} />,
      );

      expect(
        StyleSheet.flatten(getByTestId("navigation-header-spacer").props.style),
      ).toMatchObject({ width: 32, height: 32 });
    });
  });

  // The bar screens draw themselves, such as Discover's, with the stack
  // header's geometry.
  describe("NavigationHeaderBar", () => {
    const barStyle = (element: React.ReactElement) =>
      StyleSheet.flatten(
        renderWithProviders(element).getByTestId("navigation-header").props
          .style,
      );

    it("puts its row where the stack header's is", () => {
      expect(barStyle(<NavigationHeaderBar title="Discover" />)).toMatchObject({
        paddingTop: mockInsets.top + 8,
        paddingBottom: 24,
      });
    });

    it("adds only the row's spacing in content that already clears the top inset", () => {
      expect(
        barStyle(<NavigationHeaderBar title="Discover" isBelowTopInset />),
      ).toMatchObject({ paddingTop: 8 });
    });

    it("sets the title as the stack header does", () => {
      const { getByText } = renderWithProviders(
        <NavigationHeaderBar title="2 Tabs" />,
      );

      expect(StyleSheet.flatten(getByText("2 Tabs").props.style)).toMatchObject(
        { fontFamily: "Inter-Variable", fontWeight: "600", fontSize: 18 },
      );
    });

    it("keeps a title alone centered, between spacers as large as a button", () => {
      const { getAllByTestId } = renderWithProviders(
        <NavigationHeaderBar title="Discover" />,
      );

      const spacers = getAllByTestId("navigation-header-spacer");
      expect(spacers).toHaveLength(2);
      spacers.forEach((spacer) =>
        expect(StyleSheet.flatten(spacer.props.style)).toMatchObject({
          width: 32,
          height: 32,
        }),
      );
    });

    it("draws the buttons it's given beside the title", () => {
      const { getByText, queryAllByTestId } = renderWithProviders(
        <NavigationHeaderBar
          title="Recent"
          left={<Text>Back</Text>}
          right={<Text>More</Text>}
        />,
      );

      expect(getByText("Back")).toBeTruthy();
      expect(getByText("More")).toBeTruthy();
      expect(queryAllByTestId("navigation-header-spacer")).toHaveLength(0);
    });
  });
});
