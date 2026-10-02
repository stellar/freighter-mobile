import HistoryList from "components/screens/HistoryScreen/HistoryList";
import {
  HISTORY_SKELETON_ROW_COUNT,
  HISTORY_SKELETON_ROW_HEIGHT,
} from "components/screens/HistoryScreen/HistorySkeletonRows";
import {
  DEFAULT_PADDING,
  NETWORKS,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { pxValue } from "helpers/dimensions";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Dimensions, StyleSheet } from "react-native";

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => key,
}));
jest.mock("hooks/useIsReduceMotionEnabled", () => () => false);

const props = (overrides: Record<string, unknown>) =>
  ({
    publicKey: "GA",
    networkDetails: mapNetworkToNetworkDetails(NETWORKS.PUBLIC),
    onRefresh: jest.fn(),
    historyData: null,
    isLoading: true,
    error: null,
    refreshActionPosition: "center",
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("HistoryList loading placeholder", () => {
  it("renders the spinner by default (the History screen's look is unchanged)", () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <HistoryList {...props({})} />,
    );
    expect(getByTestId("spinner")).toBeTruthy();
    expect(queryByTestId("history-skeleton")).toBeNull();
  });

  it("renders three full-width skeleton rows when opted in", () => {
    const { getByTestId, getAllByTestId, queryByTestId } = renderWithProviders(
      <HistoryList {...props({ loadingPlaceholder: "skeleton" })} />,
    );
    expect(queryByTestId("spinner")).toBeNull();
    const wrapper = getByTestId("history-skeleton");
    expect(wrapper.props.accessibilityState).toEqual({ busy: true });
    expect(wrapper.props.accessibilityLabel).toBe("history.loadingA11yLabel");
    const rows = getAllByTestId("history-skeleton-row", {
      includeHiddenElements: true,
    });
    expect(rows).toHaveLength(HISTORY_SKELETON_ROW_COUNT);
    expect(StyleSheet.flatten(rows[0].props.style)).toEqual({
      width: Dimensions.get("window").width - 2 * pxValue(DEFAULT_PADDING),
      height: pxValue(HISTORY_SKELETON_ROW_HEIGHT),
    });
  });

  it("drops the skeleton once sections arrive", () => {
    const { rerender, queryByTestId } = renderWithProviders(
      <HistoryList {...props({ loadingPlaceholder: "skeleton" })} />,
    );
    rerender(
      <HistoryList
        {...props({
          loadingPlaceholder: "skeleton",
          isLoading: false,
          historyData: {
            history: [{ monthYear: "September 2026", operations: [] }],
          },
        })}
      />,
    );
    expect(queryByTestId("history-skeleton")).toBeNull();
  });
});
