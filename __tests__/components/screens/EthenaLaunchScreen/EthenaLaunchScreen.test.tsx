import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { EthenaLaunchScreen } from "components/screens/EthenaLaunchScreen";
import { EthenaLaunchHero } from "components/screens/EthenaLaunchScreen/EthenaLaunchHero";
import {
  EthenaLaunchPromoSource,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { pxValue } from "helpers/dimensions";
import { markEthenaLaunchPromoSeen } from "helpers/ethenaLaunchPromo";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";
import { Dimensions, ScrollView, StatusBar, StyleSheet } from "react-native";
import { analytics } from "services/analytics";

jest.mock("@react-native-async-storage/async-storage");
jest.mock("helpers/screenshots");

jest.mock("helpers/ethenaLaunchPromo", () => ({
  markEthenaLaunchPromoSeen: jest.fn(() => Promise.resolve()),
}));

jest.mock("services/analytics", () => ({
  analytics: {
    track: jest.fn(),
    trackDiscoverTabCreated: jest.fn(),
  },
}));

const mockOpenInAppBrowser = jest.fn(() => Promise.resolve());
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: mockOpenInAppBrowser }),
}));

const USDE_SWAP_URL =
  "https://www.sushi.com/stellar/swap?token0=CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA&token1=CCNOV6XVI2O5BSTA3232GIRUQULDEBV7IWGKM6QKI6II5OIIQTU24JJN";
const SUSDE_SWAP_URL =
  "https://www.sushi.com/stellar/swap?token0=CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA&token1=CACSKWC753QVGC4J6YPDBIR2BEHFVWIAE7CBSS3HOVYMN623OAIQYE2M";

const mockTrack = analytics.track as jest.Mock;
const mockTrackTabCreated = analytics.trackDiscoverTabCreated as jest.Mock;
const mockMarkSeen = markEthenaLaunchPromoSeen as jest.Mock;
const mockUseIsFocused = useIsFocused as jest.Mock;

type ScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.ETHENA_LAUNCH_SCREEN
>;

const makeNavigation = () => ({
  goBack: jest.fn(),
  navigate: jest.fn(),
  popTo: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
});

const renderScreen = (
  source: EthenaLaunchPromoSource = "banner",
  navigation = makeNavigation(),
) => {
  const props = {
    navigation,
    route: {
      key: "ethena-launch",
      name: ROOT_NAVIGATOR_ROUTES.ETHENA_LAUNCH_SCREEN,
      params: { source },
    },
  } as unknown as ScreenProps;

  renderWithProviders(<EthenaLaunchScreen {...props} />);

  return navigation;
};

const styleOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe("EthenaLaunchScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsFocused.mockReturnValue(true);
    useBrowserTabsStore.setState({
      tabs: [],
      activeTabId: null,
      showTabOverview: true,
    });
    useRemoteConfigStore.setState({ discover_enabled: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the hero copy, both tokens and Learn more", () => {
    renderScreen();

    expect(screen.getByText("Meet Ethena on Stellar")).toBeTruthy();
    expect(
      screen.getByText("Discover USDe and sUSDe,\nnow available on Stellar."),
    ).toBeTruthy();
    expect(screen.getByText("Scroll to discover tokens")).toBeTruthy();

    expect(screen.getByText("USDe")).toBeTruthy();
    expect(screen.getByText("Synthetic Dollar")).toBeTruthy();
    expect(
      screen.getByText(
        "A synthetic dollar designed to maintain a value of $1.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Swap to USDe")).toBeTruthy();
    expect(screen.getByText("Receive USDe")).toBeTruthy();

    expect(screen.getByText("sUSDe")).toBeTruthy();
    expect(screen.getByText("Staked USDe")).toBeTruthy();
    expect(
      screen.getByText(
        "A staked version of USDe that accrues variable protocol rewards.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Swap to sUSDe")).toBeTruthy();
    expect(screen.getByText("Receive sUSDe")).toBeTruthy();

    expect(screen.getByText("Learn more about Ethena")).toBeTruthy();
  });

  it.each<EthenaLaunchPromoSource>(["launch", "banner"])(
    "marks the promo seen and tracks the view from %s on mount",
    (source) => {
      renderScreen(source);

      expect(mockMarkSeen).toHaveBeenCalledTimes(1);
      expect(mockTrack).toHaveBeenCalledWith("ethena_launch.promo_viewed", {
        source,
      });
    },
  );

  it("opens USDe's Sushi pair in a new Discover tab and closes the promo", () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByTestId("ethena-launch-swap-usde"));

    const { tabs, activeTabId, showTabOverview } =
      useBrowserTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].url).toBe(USDE_SWAP_URL);
    expect(activeTabId).toBe(tabs[0].id);
    expect(showTabOverview).toBe(false);
    expect(navigation.popTo).toHaveBeenCalledWith("MainTabStack", {
      screen: "Discovery",
    });
    expect(mockTrack).toHaveBeenCalledWith("ethena_launch.swap_tapped", {
      token: "USDe",
    });
    expect(mockTrackTabCreated).toHaveBeenCalledWith(1, "ethena_launch_promo");
  });

  it("opens sUSDe's Sushi pair", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId("ethena-launch-swap-susde"));

    const { tabs } = useBrowserTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].url).toBe(SUSDE_SWAP_URL);
    expect(mockTrack).toHaveBeenCalledWith("ethena_launch.swap_tapped", {
      token: "sUSDe",
    });
  });

  it("hides both Swap buttons while Discover is switched off", () => {
    useRemoteConfigStore.setState({ discover_enabled: false });

    renderScreen();

    expect(screen.queryByTestId("ethena-launch-swap-usde")).toBeNull();
    expect(screen.queryByTestId("ethena-launch-swap-susde")).toBeNull();
    expect(screen.getByTestId("ethena-launch-receive-usde")).toBeTruthy();
    expect(screen.getByTestId("ethena-launch-receive-susde")).toBeTruthy();
  });

  it("opens the Receive QR over the promo", () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByTestId("ethena-launch-receive-susde"));

    expect(navigation.navigate).toHaveBeenCalledWith("ScanReceiveScreen", {
      initialTab: "receive",
    });
    expect(navigation.popTo).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith("ethena_launch.receive_tapped", {
      token: "sUSDe",
    });
  });

  it("opens Ethena's docs in the in-app browser", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId("ethena-launch-learn-more"));

    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
      "https://docs.ethena.fi/",
    );
    expect(mockTrack).toHaveBeenCalledWith("ethena_launch.learn_more_tapped");
  });

  it("closes with the ✕", () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByTestId("ethena-launch-close"));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  // Time comes from a Date.now spy, not fake timers: StatusBar parks a
  // setImmediate handle in a static, and a fake one left there makes the real
  // clearImmediate corrupt Node's immediate queue on a later unmount.
  it("runs one action for a burst of taps", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    const navigation = renderScreen();

    fireEvent.press(screen.getByTestId("ethena-launch-swap-usde"));
    fireEvent.press(screen.getByTestId("ethena-launch-swap-usde"));
    fireEvent.press(screen.getByTestId("ethena-launch-receive-usde"));

    expect(useBrowserTabsStore.getState().tabs).toHaveLength(1);
    expect(navigation.popTo).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();

    now.mockReturnValue(1_000_999);
    fireEvent.press(screen.getByTestId("ethena-launch-receive-usde"));
    expect(navigation.navigate).not.toHaveBeenCalled();

    now.mockReturnValue(1_001_000);
    fireEvent.press(screen.getByTestId("ethena-launch-receive-usde"));
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it("leaves the status bar to the theme while another screen covers it", () => {
    renderScreen();
    expect(
      screen.UNSAFE_getAllByType(StatusBar).map((bar) => bar.props.barStyle),
    ).toEqual(["light-content"]);

    screen.unmount();
    mockUseIsFocused.mockReturnValue(false);
    renderScreen();

    expect(screen.UNSAFE_queryAllByType(StatusBar)).toHaveLength(0);
  });

  it.each(["light", "dark"] as const)("looks the same in %s mode", (scheme) => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);

    renderScreen();

    expect(styleOf("ethena-launch-screen")).toMatchObject({
      backgroundColor: "#000000",
    });
    expect(
      StyleSheet.flatten(
        screen.getByText("Meet Ethena on Stellar").props.style,
      ),
    ).toMatchObject({ color: "#ededed" });
    expect(styleOf("ethena-launch-swap-usde")).toMatchObject({
      backgroundColor: "#ededed",
    });
    expect(styleOf("ethena-launch-receive-usde")).toMatchObject({
      borderColor: "#343434",
    });
  });

  // No fake timers below: the screen mounts a StatusBar (see the burst test).
  it("starts the entrance when the transition in ends", () => {
    const navigation = renderScreen();
    const isPlaying = () =>
      screen.UNSAFE_getByType(EthenaLaunchHero).props.isEntrancePlaying;
    const [event, onTransitionEnd] = navigation.addListener.mock
      .calls[0] as unknown as [
      string,
      (transition: { data: { closing: boolean } }) => void,
    ];

    expect(event).toBe("transitionEnd");
    expect(isPlaying()).toBe(false);

    act(() => onTransitionEnd({ data: { closing: true } }));
    expect(isPlaying()).toBe(false);

    act(() => onTransitionEnd({ data: { closing: false } }));
    expect(isPlaying()).toBe(true);
  });

  it("scrolls the tokens into view when the cue is tapped", () => {
    renderScreen();
    const layout = (testID: string, y: number, height: number) =>
      fireEvent(screen.getByTestId(testID), "layout", {
        nativeEvent: { layout: { x: 0, y, width: 402, height } },
      });

    layout("ethena-launch-bar", 0, 104);
    layout("ethena-launch-cue", 760, 50);
    fireEvent.press(screen.getByTestId("ethena-launch-cue"));

    expect(
      screen.UNSAFE_getByType(ScrollView).instance.scrollTo,
    ).toHaveBeenCalledWith({ y: 760 - 104 - pxValue(5), animated: true });
  });

  it("shows the bar's fade only once the page has scrolled", () => {
    renderScreen();
    const scrollTo = (y: number) =>
      fireEvent.scroll(screen.getByTestId("ethena-launch-scroll"), {
        nativeEvent: { contentOffset: { x: 0, y } },
      });

    expect(screen.queryByTestId("header-fade")).toBeNull();

    scrollTo(10);
    expect(screen.getByTestId("header-fade")).toBeTruthy();

    scrollTo(0);
    expect(screen.queryByTestId("header-fade")).toBeNull();
  });

  it("keeps the hero at least one screen tall, with the cue in normal flow", () => {
    renderScreen();

    expect(styleOf("ethena-launch-hero")).toMatchObject({
      minHeight: Dimensions.get("window").height,
    });
    expect(styleOf("ethena-launch-cue").position).not.toBe("absolute");
  });

  it("keeps the cue clear of the intro on short screens", () => {
    renderScreen();

    // The space between them grows on tall screens and never drops below
    // the app's default spacing on short ones.
    expect(styleOf("ethena-launch-cue-spacer")).toMatchObject({
      flex: 1,
      minHeight: pxValue(24),
    });
  });
});
