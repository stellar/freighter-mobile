import { waitFor, within } from "@testing-library/react-native";
import { getFloatingTabBarClearance } from "components/FloatingTabBar/geometry";
import { getNavigationHeaderHeight } from "components/layout/CustomNavigationHeader";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import HistoryScreen from "components/screens/HistoryScreen/HistoryScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { SectionList, SectionListProps, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn((callback) => {
    callback();
    return () => {};
  }),
}));

// Mock the OS locale detection for consistent test behavior
jest.mock("helpers/localeUtils", () => ({
  getDeviceLanguage: jest.fn().mockReturnValue("en"),
  isSupportedLanguage: jest.fn().mockReturnValue(true),
}));

// Define a basic type for our test data
interface OperationItem {
  id: string;
  [key: string]: unknown;
}

// We need to maintain our constants for testing getItemLayout
const HISTORY_ITEM_HEIGHT = 72;
const SECTION_HEADER_HEIGHT = 42;

// Type for getItemLayout function
type GetItemLayoutFunction = NonNullable<
  SectionListProps<OperationItem>["getItemLayout"]
>;

// Mock capture for getItemLayout function
let capturedGetItemLayout: GetItemLayoutFunction | null = null;

// Mock dependencies
jest.mock("hooks/useGetHistoryData", () => ({
  useGetHistoryData: jest.fn(() => ({
    historyData: {
      history: [
        {
          monthYear: "8:2023",
          operations: [
            {
              id: "operation-1",
              type: "payment",
              created_at: "2023-09-15T10:00:00Z",
            },
            {
              id: "operation-2",
              type: "create_account",
              created_at: "2023-09-10T08:00:00Z",
            },
          ],
        },
      ],
      balances: {},
    },
    fetchData: jest.fn(),
    status: "success",
  })),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    account: {
      publicKey: "GDSJDSJDKLSJDKLJSD",
    },
  })),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({
    network: "PUBLIC",
    setSignInMethod: jest.fn(),
  })),
  getLoginType: jest.fn((biometryType) => {
    if (!biometryType) return "password";
    if (biometryType === "FaceID" || biometryType === "Face") return "face";
    if (biometryType === "TouchID" || biometryType === "Fingerprint")
      return "fingerprint";
    return "password";
  }),
}));

// Use a function-based mock component to avoid Jest error with View
jest.mock("components/screens/HistoryScreen/HistoryItem", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const MockHistoryItem = (_props: unknown) => null;

  return {
    __esModule: true,
    default: MockHistoryItem,
  };
});

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

describe("HistoryScreen", () => {
  // Reset the captured getItemLayout before each test
  beforeEach(() => {
    capturedGetItemLayout = null;
  });

  afterEach(() => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue(NO_INSETS);
  });

  // Like Discover's: the shared nav bar with a centred Text/LG/600 title,
  // floating over the list on the header fade, so rows scroll up under it and
  // fade out below its row.
  it("titles the tab Activity in a bar like Discover's, floating on the fade", () => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue({ ...NO_INSETS, top: 62 });

    const { getByTestId } = renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );

    const header = getByTestId("history-header");
    expect(StyleSheet.flatten(header.props.style)).toMatchObject({
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    });
    expect(within(header).getByTestId("header-fade")).toBeTruthy();
    const bar = within(header).getByTestId("navigation-header");
    expect(bar.props.className).not.toContain("bg-base-0");
    // The bar clears the status bar itself: its row starts 8pt below the
    // 62pt inset, as every other screen's does.
    expect(StyleSheet.flatten(bar.props.style).paddingTop).toBe(70);
    // The bar draws the title as it does Discover's (Text/LG/600).
    expect(within(bar).getByText("Activity")).toBeTruthy();
  });

  it("starts the list's content and spinners below the bar", () => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue({ ...NO_INSETS, top: 62 });

    const { UNSAFE_getByType: getByType } = renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );

    const list = getByType(HistoryList);
    // The list runs from the screen's top, under the bar: it takes no
    // safe-area inset or padding class of its own, and its container pads
    // nothing.
    expect(list.props.ignoreTopInset).toBe(true);
    expect(list.props.className ?? "").not.toMatch(/\bpt-/);
    expect(list.props.topInset).toBe(getNavigationHeaderHeight(62));
    expect(StyleSheet.flatten(list.parent?.props.style)?.paddingTop ?? 0).toBe(
      0,
    );
  });

  it("ends its list clear of the floating tab bar", () => {
    // The iPhone 17 Pro's home indicator, so a clearance that ignored the
    // inset would show.
    (useSafeAreaInsets as jest.Mock).mockReturnValue({
      ...NO_INSETS,
      bottom: 34,
    });

    const { UNSAFE_getByType: getByType } = renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );

    expect(
      StyleSheet.flatten(getByType(SectionList).props.contentContainerStyle)
        .paddingBottom,
    ).toBe(getFloatingTabBarClearance(34));
  });

  it("renders loading state correctly", async () => {
    // Override the mock to return loading status
    jest
      .requireMock("hooks/useGetHistoryData")
      .useGetHistoryData.mockReturnValueOnce({
        historyData: null,
        fetchData: jest.fn(),
        isLoading: true,
        error: null,
        isRefreshing: false,
        isNavigationRefresh: false,
      });

    const { getByTestId } = renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("spinner")).toBeTruthy();
    });
  });

  it("renders history items in sections", async () => {
    const { getByText } = renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );

    // Should show the month header (September)
    await waitFor(() => {
      expect(getByText("September")).toBeTruthy();
    });
  });

  it("renders empty state when no history data", async () => {
    // Override the mock to return empty history
    jest
      .requireMock("hooks/useGetHistoryData")
      .useGetHistoryData.mockReturnValueOnce({
        historyData: { history: [], balances: {} },
        fetchData: jest.fn(),
        isLoading: false,
        error: null,
        isRefreshing: false,
        isNavigationRefresh: false,
      });

    const { getByText } = renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );

    await waitFor(() => {
      expect(getByText("No transactions to show")).toBeTruthy();
    });
  });

  it("renders error state", async () => {
    // Override the mock to return error status
    jest
      .requireMock("hooks/useGetHistoryData")
      .useGetHistoryData.mockReturnValueOnce({
        historyData: null,
        fetchData: jest.fn(),
        isLoading: false,
        error: "Error loading history",
        isRefreshing: false,
        isNavigationRefresh: false,
      });

    const { getByText } = renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );

    await waitFor(() => {
      expect(getByText("Error loading history")).toBeTruthy();
    });
  });

  it("applies proper getItemLayout calculations", async () => {
    renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );

    await waitFor(() => {
      // Check if getItemLayout function was captured
      expect(capturedGetItemLayout).toBeDefined();

      if (capturedGetItemLayout) {
        // Test item position calculations for first item
        const item0Position = capturedGetItemLayout(null, 0);
        expect(item0Position.length).toBe(HISTORY_ITEM_HEIGHT);
        // First position should take into account section header
        expect(item0Position.offset).toBeGreaterThanOrEqual(
          SECTION_HEADER_HEIGHT,
        );

        // Test item position calculations for second item
        const item1Position = capturedGetItemLayout(null, 1);
        expect(item1Position.length).toBe(HISTORY_ITEM_HEIGHT);
        // Second item should be after first item
        expect(item1Position.offset).toBeGreaterThan(item0Position.offset);
        // Check that the spacing is as expected
        expect(
          item1Position.offset - item0Position.offset,
        ).toBeGreaterThanOrEqual(HISTORY_ITEM_HEIGHT);
      }
    });
  });
});
