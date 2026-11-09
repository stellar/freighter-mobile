import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { screen, within } from "@testing-library/react-native";
import HomeScreenHeader from "components/screens/HomeScreen/HomeScreenHeader";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { StyleSheet, Text } from "react-native";

// An iPhone 17 Pro's top inset, tall enough that the bar's row starts 8pt
// below it rather than at the 45dp minimum (as CustomNavigationHeader.test.tsx
// has it).
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 62, bottom: 34, left: 0, right: 0 }),
}));

const MAINTENANCE_OFF = {
  showMaintenanceBanner: false,
  bannerContent: { title: "", theme: "warning" },
};
const UPDATE_OFF = {
  showBannerUpdateNotice: false,
  updateMessage: "",
  openAppStore: jest.fn(),
};

let mockMaintenance: Record<string, unknown> = MAINTENANCE_OFF;
let mockAppUpdate: Record<string, unknown> = UPDATE_OFF;

jest.mock("hooks/useMaintenanceMode", () => ({
  useMaintenanceMode: () => mockMaintenance,
}));

// The real hook reads AsyncStorage in an effect and sets state after the test
// has finished rendering.
jest.mock("hooks/useAppUpdate", () => ({
  useAppUpdate: () => mockAppUpdate,
}));

/** Minimal shape the header reads: navigation.canGoBack plus options. */
const headerProps = (options: Record<string, unknown> = {}) =>
  ({
    navigation: { canGoBack: () => false, goBack: jest.fn() },
    options,
    route: { key: "route", name: "Home" },
  }) as unknown as NativeStackHeaderProps;

const renderHeader = (options: Record<string, unknown> = {}) =>
  renderWithProviders(<HomeScreenHeader {...headerProps(options)} />);

/**
 * A banner sits in the header's wrapper after the bar, not inside the bar's
 * row, where it would end up beside the account switcher.
 */
const expectBannerUnderBar = (bannerText: string) => {
  const bar = screen.getByTestId("navigation-header");
  const banner = screen.getByText(bannerText);
  // Every native view under the header, in the order they are drawn.
  const views = screen.UNSAFE_root.findAll(
    (node) => typeof node.type === "string",
  );

  expect(within(bar).queryByText(bannerText)).toBeNull();
  expect(views.indexOf(banner)).toBeGreaterThan(views.indexOf(bar));
};

describe("HomeScreenHeader", () => {
  beforeEach(() => {
    mockMaintenance = MAINTENANCE_OFF;
    mockAppUpdate = UPDATE_OFF;
  });

  it("draws #72's header bar", () => {
    renderHeader({
      headerLeft: () => <Text>Account switcher</Text>,
      headerRight: () => <Text>Header buttons</Text>,
    });

    const bar = screen.getByTestId("navigation-header");

    // The row starts 8pt below the 62pt inset, with the bar's 16pt sides and
    // 24pt underneath, the same as every other screen's header.
    expect(StyleSheet.flatten(bar.props.style)).toMatchObject({
      paddingTop: 70,
      paddingHorizontal: 16,
      paddingBottom: 24,
    });
    expect(within(bar).getByText("Account switcher")).toBeTruthy();
    expect(within(bar).getByText("Header buttons")).toBeTruthy();
    expect(screen.queryAllByTestId("navigation-header-spacer")).toHaveLength(0);
  });

  it("never falls back to a back button, which a tab's root screen has no use for", () => {
    renderHeader();

    expect(screen.queryByLabelText("Back")).toBeNull();
    // The bar holds both sides with its spacers instead.
    expect(screen.getAllByTestId("navigation-header-spacer")).toHaveLength(2);
  });

  it("keeps the maintenance banner under the bar", () => {
    mockMaintenance = {
      showMaintenanceBanner: true,
      bannerContent: { title: "Scheduled maintenance", theme: "warning" },
    };

    renderHeader();

    expectBannerUnderBar("Scheduled maintenance");
  });

  it("keeps the update banner under the bar", () => {
    mockAppUpdate = {
      ...UPDATE_OFF,
      showBannerUpdateNotice: true,
      updateMessage: "A new version is available",
    };

    renderHeader();

    expectBannerUnderBar("A new version is available");
  });

  // Content scrolls up under Home's header and fades out below the row
  // (HeaderFade, Figma ?node-id=3705-77862 and 3272-113092).
  describe("fade", () => {
    it("draws the bar on a fade instead of its own fill", () => {
      renderHeader();

      expect(screen.getByTestId("header-fade")).toBeTruthy();
      expect(
        screen.getByTestId("navigation-header").props.className,
      ).not.toContain("bg-base-0");
    });

    it("stays solid with a banner under the bar", () => {
      // A fade between the row and an opaque banner would show content
      // through a gap in the header.
      mockMaintenance = {
        showMaintenanceBanner: true,
        bannerContent: { title: "Scheduled maintenance", theme: "warning" },
      };

      renderHeader();

      expect(screen.queryByTestId("header-fade")).toBeNull();
      expect(screen.getByTestId("navigation-header").props.className).toContain(
        "bg-base-0",
      );
    });
  });
});
