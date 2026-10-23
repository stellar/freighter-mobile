import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";
import { SectionList, StyleSheet } from "react-native";

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
    isLoading: false,
    error: null,
    refreshActionPosition: "center",
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

// The History tab runs its list from the screen's top, under its header's
// fade, so the list starts its content and spinners that far down.
describe("HistoryList top inset", () => {
  afterEach(() => jest.restoreAllMocks());

  const list = (view: ReturnType<typeof renderWithProviders>) =>
    view.UNSAFE_getByType(SectionList);

  // Where the content and the spinner start, as useScrollUnderHeader puts
  // them: an inset on iOS (the spinner follows it), padding and an offset
  // spinner on Android.
  const contentTop = (view: ReturnType<typeof renderWithProviders>) => {
    const { props: listProps } = list(view);
    return {
      inset: listProps.contentInset?.top ?? 0,
      padding:
        StyleSheet.flatten(listProps.contentContainerStyle).paddingTop ?? 0,
      spinner: listProps.refreshControl.props.progressViewOffset ?? 0,
    };
  };

  it("insets its content by it on iOS, so the spinner shows right below it", () => {
    const view = renderWithProviders(
      <HistoryList {...props({ topInset: 126 })} />,
    );

    expect(contentTop(view)).toEqual({ inset: 126, padding: 0, spinner: 0 });
    expect(list(view).props.contentOffset).toEqual({ x: 0, y: -126 });
  });

  it("pads its content and offsets the spinner by it on Android", () => {
    jest.replaceProperty(RN.Platform, "OS", "android");

    const view = renderWithProviders(
      <HistoryList {...props({ topInset: 126 })} />,
    );

    expect(contentTop(view)).toEqual({ inset: 0, padding: 126, spinner: 126 });
  });

  it("drops the navigation refresh spinner below it instead of the list", () => {
    // The spinner sits above the list while it shows, so it takes the inset
    // and the list doesn't, or the list would start twice as far down.
    const view = renderWithProviders(
      <HistoryList {...props({ topInset: 126, isNavigationRefresh: true })} />,
    );

    expect(
      StyleSheet.flatten(
        view.getByTestId("history-navigation-refresh").props.style,
      ).marginTop,
    ).toBe(126);
    expect(contentTop(view)).toEqual({ inset: 0, padding: 0, spinner: 0 });
  });

  it("adds nothing without one, as on a token's details", () => {
    const view = renderWithProviders(<HistoryList {...props({})} />);

    expect(contentTop(view)).toEqual({ inset: 0, padding: 0, spinner: 0 });
    expect(
      StyleSheet.flatten(list(view).props.contentContainerStyle),
    ).toMatchObject({ flexGrow: 1, minHeight: "100%" });
  });
});
