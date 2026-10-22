import { within } from "@testing-library/react-native";
import { getNavigationHeaderHeight } from "components/layout/CustomNavigationHeader";
import DiscoveryHomepage from "components/screens/DiscoveryScreen/components/DiscoveryHomepage";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { ScrollView, StyleSheet } from "react-native";

// An iPhone 17 Pro's top inset. The homepage sits below it (its tab pads the
// status bar), so its bar adds only the row's own spacing.
const TOP_INSET = 62;
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 62, bottom: 34, left: 0, right: 0 }),
}));

jest.mock("react-native-view-shot", () => "ViewShot");
jest.mock("helpers/screenshots", () => ({
  captureTabScreenshot: jest.fn(() => Promise.resolve()),
}));
jest.mock("ducks/browserTabs", () => ({
  useBrowserTabsStore: Object.assign(
    () => ({ goToPage: jest.fn(), showTabOverview: jest.fn() }),
    { getState: () => ({ tabs: [], updateTab: jest.fn() }) },
  ),
}));
jest.mock("hooks/useDiscoveryData", () => ({
  __esModule: true,
  default: () => ({
    protocols: [],
    trendingCarouselItems: [],
    recentItems: [],
    dappsItems: [],
    addRecentProtocol: jest.fn(),
    clearRecentProtocols: jest.fn(),
  }),
  protocolToListItem: jest.fn(),
}));
// Only the header and the scroll view's layout matter here.
jest.mock(
  "components/screens/DiscoveryScreen/components/TrendingCarouselSection",
  () => () => null,
);
jest.mock(
  "components/screens/DiscoveryScreen/components/VerticalListSection",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock(
  "components/screens/DiscoveryScreen/components/ProtocolDetailsBottomSheet",
  () => () => null,
);
jest.mock(
  "components/screens/DiscoveryScreen/components/ExpandedSectionView",
  () => () => null,
);

// Like Home's, Discover's content scrolls up under its header and fades out
// below the title row (HeaderFade).
describe("DiscoveryHomepage header", () => {
  const renderHomepage = () =>
    renderWithProviders(<DiscoveryHomepage tabId="tab-1" />);

  it("floats the Discover bar over the list, on the fade", () => {
    const view = renderHomepage();

    const header = view.getByTestId("discover-header");
    expect(StyleSheet.flatten(header.props.style)).toMatchObject({
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    });
    expect(within(header).getByTestId("header-fade")).toBeTruthy();
    const bar = within(header).getByTestId("navigation-header");
    expect(bar.props.className).not.toContain("bg-base-0");
    expect(within(bar).getByText("Discover")).toBeTruthy();
  });

  it("draws the header over the list, which it follows in the tree", () => {
    const view = renderHomepage();
    const nodes = view.UNSAFE_root.findAll(
      (node) => typeof node.type === "string",
    );

    expect(nodes.indexOf(view.getByTestId("discover-header"))).toBeGreaterThan(
      nodes.indexOf(view.UNSAFE_getByType(ScrollView)),
    );
  });

  it("starts the list's content below the bar", () => {
    const view = renderHomepage();

    // The bar's height less the inset its tab already clears: 8pt above the
    // 32pt row and 24pt below it.
    expect(
      StyleSheet.flatten(
        view.UNSAFE_getByType(ScrollView).props.contentContainerStyle,
      ).paddingTop,
    ).toBe(getNavigationHeaderHeight(TOP_INSET) - TOP_INSET);
  });
});
