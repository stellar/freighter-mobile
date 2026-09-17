import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Text } from "react-native";

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => key,
}));

/**
 * The token detail screen puts its ENTIRE page in `ListHeaderComponent`, so a
 * remount there drops and rebuilds the chart: `token_chart.viewed` fires a
 * second time for the default range (inflating a frozen cross-platform
 * metric) and a timeframe chosen during the history load is reset.
 *
 * React reconciles by element type, so this only holds while every state of
 * the list renders the header inside the same container.
 */
describe("HistoryList header stability", () => {
  const mounts = { count: 0 };
  const Header: React.FC = () => {
    React.useEffect(() => {
      mounts.count += 1;
    }, []);
    return <Text testID="stable-header">header</Text>;
  };

  const props = (overrides: Record<string, unknown>) =>
    ({
      publicKey: "GA",
      networkDetails: mapNetworkToNetworkDetails(NETWORKS.PUBLIC),
      onRefresh: jest.fn(),
      isRefreshing: false,
      isNavigationRefresh: false,
      ListHeaderComponent: <Header />,
      ...overrides,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  it("keeps one header instance across loading, empty and loaded", () => {
    mounts.count = 0;

    const { rerender, getByTestId } = renderWithProviders(
      <HistoryList
        {...props({ historyData: null, isLoading: true, error: null })}
      />,
    );
    expect(getByTestId("stable-header")).toBeTruthy();
    expect(mounts.count).toBe(1);

    // Loading -> empty.
    rerender(
      <HistoryList
        {...props({
          historyData: { history: [] },
          isLoading: false,
          error: null,
        })}
      />,
    );
    expect(mounts.count).toBe(1);

    // Empty -> has transactions. This is the transition that used to swap a
    // ScrollView for a SectionList and rebuild the whole subtree.
    rerender(
      <HistoryList
        {...props({
          historyData: {
            history: [{ monthYear: "September 2026", operations: [] }],
          },
          isLoading: false,
          error: null,
        })}
      />,
    );
    expect(mounts.count).toBe(1);
  });

  /**
   * A failed refresh keeps `rawHistoryData`, so the list stays non-empty and
   * `ListEmptyComponent` is never consulted. Routing every state through that
   * one component therefore hid the failure behind the rows it already had —
   * a transaction list showing stale data with nothing to say so.
   */
  it("surfaces a refresh failure instead of leaving the cached rows up", () => {
    mounts.count = 0;

    const loaded = {
      historyData: {
        history: [{ monthYear: "September 2026", operations: [] }],
      },
      isLoading: false,
      error: null,
    };

    const { rerender, queryByText, getByTestId } = renderWithProviders(
      <HistoryList {...props(loaded)} />,
    );
    expect(getByTestId("stable-header")).toBeTruthy();
    expect(queryByText("history.error")).toBeNull();

    // The refresh fails: `error` is set, but the cached history survives it.
    rerender(<HistoryList {...props({ ...loaded, error: "network down" })} />);

    expect(queryByText("history.error")).toBeTruthy();
    // ...and the header still must not have been rebuilt to say so.
    expect(mounts.count).toBe(1);
  });
});
