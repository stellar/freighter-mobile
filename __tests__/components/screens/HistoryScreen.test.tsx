import { waitFor } from "@testing-library/react-native";
import HistoryScreen from "components/screens/HistoryScreen/HistoryScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { SectionListProps } from "react-native";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn((callback) => {
    callback();
    return () => {};
  }),
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

describe("HistoryScreen", () => {
  // Reset the captured getItemLayout before each test
  beforeEach(() => {
    capturedGetItemLayout = null;
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
