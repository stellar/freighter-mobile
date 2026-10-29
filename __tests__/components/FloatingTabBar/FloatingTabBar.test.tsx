import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { FloatingTabBar } from "components/FloatingTabBar";
import {
  PillBackground,
  getPillSelectionColor,
} from "components/FloatingTabBar/PillBackground";
import { getThemeColors } from "config/colors";
import { MAIN_TAB_ROUTES } from "config/routes";
import React from "react";
import * as RN from "react-native";
import {
  ReduceMotion,
  ReducedMotionConfig,
  getAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// The global mock exports only `createBottomTabNavigator`, and the bar needs
// the real height context.
jest.mock("@react-navigation/bottom-tabs", () =>
  jest.requireActual("@react-navigation/bottom-tabs"),
);

// The pill renders for real: frosted, on iOS without Liquid Glass.
jest.mock("@react-native-community/blur", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    BlurView: (props: object) => createElement(View, props),
  };
});

let mockKeyboardVisible = false;
jest.mock("hooks/useKeyboardVisible", () => () => mockKeyboardVisible);

let mockReduceMotion = true;
jest.mock("hooks/useIsReduceMotionEnabled", () => () => mockReduceMotion);

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Reanimated applies a changed value to a view on the next frame, and Jest's
 * fake timers run a frame every 16ms.
 */
const ONE_FRAME_MS = 16;
const SELECTION_SLIDE_MS = 200;

// Discover has no test ID in the app; `tab-discovery` is this file's own.
const TABS = [
  {
    name: MAIN_TAB_ROUTES.TAB_HISTORY,
    testID: "tab-history",
    label: "History",
  },
  { name: MAIN_TAB_ROUTES.TAB_HOME, testID: "tab-home", label: "Home" },
  {
    name: MAIN_TAB_ROUTES.TAB_DISCOVERY,
    testID: "tab-discovery",
    label: "Discover",
  },
];

/**
 * What React Navigation hands a tab bar: the first `tabCount` tabs above,
 * with `index` focused. Each route's icon is a `jest.fn` that draws a view
 * named after the route.
 */
const buildProps = ({ index = 1, tabCount = TABS.length } = {}) => {
  const tabs = TABS.slice(0, tabCount);
  const icons = Object.fromEntries(
    tabs.map(({ name }) => [
      name,
      jest.fn(() => <RN.View testID={`icon-${name}`} />),
    ]),
  );
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  const props = {
    state: {
      key: "tabs",
      index,
      routeNames: tabs.map(({ name }) => name),
      routes: tabs.map(({ name }) => ({
        key: `${name}-key`,
        name,
        params: { screenParam: name },
      })),
      history: [],
      preloadedRouteKeys: [],
      stale: false,
      type: "tab",
    },
    descriptors: Object.fromEntries(
      tabs.map(({ name, testID, label }) => [
        `${name}-key`,
        {
          options: {
            tabBarButtonTestID: testID,
            tabBarAccessibilityLabel: label,
            tabBarIcon: icons[name],
          },
        },
      ]),
    ),
    navigation,
    insets: NO_INSETS,
  } as unknown as BottomTabBarProps;

  return { props, icons, navigation };
};

const barStyle = () =>
  RN.StyleSheet.flatten(screen.getByTestId("floating-tab-bar").props.style);

const selectionStyle = () =>
  getAnimatedStyle(screen.getByTestId("floating-tab-bar-selection"));

/** The first `tabCount` targets, in tab order, by the test IDs Maestro uses. */
const targets = (tabCount = TABS.length) =>
  TABS.slice(0, tabCount).map(({ testID }) => screen.getByTestId(testID));

describe("FloatingTabBar", () => {
  beforeEach(() => {
    mockKeyboardVisible = false;
    mockReduceMotion = true;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    (useSafeAreaInsets as jest.Mock).mockReturnValue(NO_INSETS);
  });

  // React Native gives VoiceOver no trait for the tab role, so on iOS the
  // targets are buttons, as in React Navigation's own bar.
  it.each([
    { platform: "iOS", os: "ios", role: "button" },
    { platform: "Android", os: "android", role: "tab" },
  ] as const)(
    "renders one target per tab with its test ID, label and role: a $role on $platform",
    ({ os, role }) => {
      jest.replaceProperty(RN.Platform, "OS", os);
      render(<FloatingTabBar {...buildProps().props} />);

      const tabTargets = screen.getAllByRole(role);

      expect(tabTargets.map((target) => target.props.testID)).toEqual([
        "tab-history",
        "tab-home",
        "tab-discovery",
      ]);
      expect(
        tabTargets.map((target) => target.props.accessibilityLabel),
      ).toEqual(["History", "Home", "Discover"]);
      expect(
        tabTargets.map((target) => target.props.accessibilityState.selected),
      ).toEqual([false, true, false]);
    },
  );

  it("shows each tab in iOS's large content viewer, titled with its label", () => {
    // As React Navigation's own bar does: with a large accessibility text
    // size, a long press on a tab shows its icon and title enlarged.
    render(<FloatingTabBar {...buildProps().props} />);

    const tabTargets = ["tab-history", "tab-home", "tab-discovery"].map((id) =>
      screen.getByTestId(id),
    );

    expect(
      tabTargets.map(
        (target) => target.props.accessibilityShowsLargeContentViewer,
      ),
    ).toEqual([true, true, true]);
    expect(
      tabTargets.map((target) => target.props.accessibilityLargeContentTitle),
    ).toEqual(["History", "Home", "Discover"]);
  });

  it("leaves each target reachable on its own", () => {
    // An accessible bar would group the targets into one element, which
    // hides `tab-home` from VoiceOver and from Maestro.
    render(<FloatingTabBar {...buildProps().props} />);

    expect(screen.getByTestId("floating-tab-bar").props.accessible).not.toBe(
      true,
    );
  });

  it("sizes the pill to the tab count", () => {
    const { rerender } = render(<FloatingTabBar {...buildProps().props} />);

    expect(screen.UNSAFE_getByType(PillBackground).props).toMatchObject({
      width: 227,
      height: 64,
    });

    rerender(<FloatingTabBar {...buildProps({ tabCount: 2 }).props} />);

    expect(screen.UNSAFE_getByType(PillBackground).props).toMatchObject({
      width: 158,
      height: 64,
    });
    expect(targets(2)).toHaveLength(2);
    expect(screen.queryByTestId("tab-discovery")).toBeNull();
  });

  it("lays each target over its slot, 69pt apart", () => {
    render(<FloatingTabBar {...buildProps().props} />);

    const frames = targets().map((target) =>
      RN.StyleSheet.flatten(target.props.style),
    );

    expect(frames).toEqual(
      [6, 75, 144].map((left) =>
        expect.objectContaining({
          position: "absolute",
          left,
          top: 4,
          width: 77,
          height: 56,
          alignItems: "center",
          justifyContent: "center",
        }),
      ),
    );
  });

  it("keeps Figma's slots with two tabs", () => {
    // Discover is off by default on production iOS.
    render(<FloatingTabBar {...buildProps({ index: 1, tabCount: 2 }).props} />);

    expect(
      targets(2).map(
        (target) => RN.StyleSheet.flatten(target.props.style).left,
      ),
    ).toEqual([6, 75]);
    expect(selectionStyle().left).toBe(75);
  });

  it("puts the selection behind the focused tab", () => {
    // Reduce Motion is on, so the selection jumps: one frame is far too
    // short for the slide.
    jest.useFakeTimers();
    const { rerender } = render(
      <FloatingTabBar {...buildProps({ index: 1 }).props} />,
    );

    expect(selectionStyle().left).toBe(75);

    rerender(<FloatingTabBar {...buildProps({ index: 0 }).props} />);
    act(() => {
      jest.advanceTimersByTime(ONE_FRAME_MS);
    });

    expect(selectionStyle().left).toBe(6);
  });

  it("slides the selection over 200ms when Reduce Motion is off", () => {
    jest.useFakeTimers();
    mockReduceMotion = false;
    const { rerender } = render(
      <FloatingTabBar {...buildProps({ index: 1 }).props} />,
    );

    rerender(<FloatingTabBar {...buildProps({ index: 0 }).props} />);
    act(() => {
      jest.advanceTimersByTime(SELECTION_SLIDE_MS / 2);
    });

    const midway = selectionStyle().left;
    expect(midway).toBeGreaterThan(6);
    expect(midway).toBeLessThan(75);

    act(() => {
      jest.advanceTimersByTime(SELECTION_SLIDE_MS / 2 + ONE_FRAME_MS);
    });

    expect(selectionStyle().left).toBe(6);
  });

  it("slides even if Reduce Motion was on at launch and is off now", () => {
    // Reanimated reads the setting once, at launch, for an animation left on
    // its System default; ReducedMotionConfig stands in for that stale
    // reading. The app's hook follows the setting live and says it's off.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.useFakeTimers();
    mockReduceMotion = false;
    const bar = (index: number) => (
      <>
        <ReducedMotionConfig mode={ReduceMotion.Always} />
        <FloatingTabBar {...buildProps({ index }).props} />
      </>
    );
    const { rerender } = render(bar(1));

    rerender(bar(0));
    act(() => {
      jest.advanceTimersByTime(SELECTION_SLIDE_MS / 2);
    });

    expect(selectionStyle().left).toBeGreaterThan(6);
    // The only warning silenced is Reanimated's notice of the override.
    expect(warn.mock.calls).toEqual([
      [expect.stringContaining("Reduced motion setting is overwritten")],
    ]);
  });

  it("emits tabPress and navigates to an unfocused tab", () => {
    const { props, navigation } = buildProps();
    render(<FloatingTabBar {...props} />);

    fireEvent.press(screen.getByTestId("tab-history"));

    expect(navigation.emit).toHaveBeenCalledWith({
      type: "tabPress",
      target: "History-key",
      canPreventDefault: true,
    });
    expect(navigation.navigate).toHaveBeenCalledWith("History", {
      screenParam: "History",
    });
    expect(navigation.emit.mock.invocationCallOrder[0]).toBeLessThan(
      navigation.navigate.mock.invocationCallOrder[0],
    );
  });

  it("doesn't navigate when the tab is focused or the press is prevented", () => {
    const { props, navigation } = buildProps();
    render(<FloatingTabBar {...props} />);

    // The focused tab still emits, so its screen can scroll to the top.
    fireEvent.press(screen.getByTestId("tab-home"));

    expect(navigation.emit).toHaveBeenLastCalledWith({
      type: "tabPress",
      target: "Home-key",
      canPreventDefault: true,
    });

    navigation.emit.mockReturnValue({ defaultPrevented: true });
    fireEvent.press(screen.getByTestId("tab-history"));

    expect(navigation.emit).toHaveBeenLastCalledWith({
      type: "tabPress",
      target: "History-key",
      canPreventDefault: true,
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("emits tabLongPress on a long press", () => {
    const { props, navigation } = buildProps();
    render(<FloatingTabBar {...props} />);

    fireEvent(screen.getByTestId("tab-discovery"), "longPress");

    expect(navigation.emit).toHaveBeenCalledWith({
      type: "tabLongPress",
      target: "Discovery-key",
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  describe.each(["light", "dark"] as const)("in %s", (scheme) => {
    const colors = getThemeColors(scheme);

    beforeEach(() => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);
    });

    it("asks each route for its icon at 28pt", () => {
      const { props, icons } = buildProps();
      render(<FloatingTabBar {...props} />);

      expect(icons[MAIN_TAB_ROUTES.TAB_HOME]).toHaveBeenLastCalledWith({
        focused: true,
        color: colors.base[1],
        size: 28,
      });
      [MAIN_TAB_ROUTES.TAB_HISTORY, MAIN_TAB_ROUTES.TAB_DISCOVERY].forEach(
        (name) => {
          expect(icons[name]).toHaveBeenLastCalledWith({
            focused: false,
            color: colors.gray[9],
            size: 28,
          });
        },
      );
      TABS.forEach(({ name, testID }) => {
        expect(
          within(screen.getByTestId(testID)).getByTestId(`icon-${name}`),
        ).toBeTruthy();
      });
    });

    it("draws the selection as Figma's capsule, in the pill's selection color", () => {
      render(<FloatingTabBar {...buildProps().props} />);

      expect(selectionStyle()).toMatchObject({
        position: "absolute",
        top: 4,
        width: 77,
        height: 56,
        borderRadius: 28,
        backgroundColor: getPillSelectionColor(scheme, colors),
      });
    });

    it("ripples a pressed target on Android, in the selection's color and shape", () => {
      jest.replaceProperty(RN.Platform, "OS", "android");
      render(<FloatingTabBar {...buildProps().props} />);

      // Pressable hands its android_ripple to the native view as this
      // background, on Android only. Borderless with a 28pt radius, the
      // ripple is as tall as the 56pt capsule the selection slides to.
      targets().forEach((target) => {
        expect(target.props.nativeBackgroundAndroid).toEqual({
          type: "RippleAndroid",
          color: RN.processColor(getPillSelectionColor(scheme, colors)),
          borderless: true,
          rippleRadius: 28,
        });
      });
    });
  });

  it("hides while the keyboard is up", () => {
    mockKeyboardVisible = true;
    render(<FloatingTabBar {...buildProps().props} />);

    expect(screen.queryByTestId("floating-tab-bar")).toBeNull();
  });

  it("floats over the screens, centred", () => {
    render(<FloatingTabBar {...buildProps().props} />);

    expect(barStyle()).toMatchObject({
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
    });
  });

  it("lets touches through around the pill", () => {
    render(<FloatingTabBar {...buildProps().props} />);

    expect(screen.getByTestId("floating-tab-bar").props.pointerEvents).toBe(
      "box-none",
    );
    expect(barStyle().bottom).toBe(16);
  });

  it("reports its clearance to React Navigation", () => {
    const onHeightChange = jest.fn();
    render(
      <BottomTabBarHeightCallbackContext.Provider value={onHeightChange}>
        <FloatingTabBar {...buildProps().props} />
      </BottomTabBarHeightCallbackContext.Provider>,
    );

    expect(onHeightChange).toHaveBeenCalledWith(96);
  });

  it("sits 6pt above the bottom inset and reports the clearance above it", () => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue({
      ...NO_INSETS,
      top: 62,
      bottom: 34,
    });
    const onHeightChange = jest.fn();
    render(
      <BottomTabBarHeightCallbackContext.Provider value={onHeightChange}>
        <FloatingTabBar {...buildProps().props} />
      </BottomTabBarHeightCallbackContext.Provider>,
    );

    expect(barStyle().bottom).toBe(40);
    expect(onHeightChange).toHaveBeenLastCalledWith(120);
  });

  it("keeps reporting its clearance while the keyboard hides it", () => {
    // Discover's search bar rises with the keyboard by this height, so it
    // must not drop to 0 when the pill hides.
    const onHeightChange = jest.fn();
    const { props } = buildProps();
    const bar = () => (
      <BottomTabBarHeightCallbackContext.Provider value={onHeightChange}>
        <FloatingTabBar {...props} />
      </BottomTabBarHeightCallbackContext.Provider>
    );

    // Mounted under the keyboard...
    mockKeyboardVisible = true;
    const { rerender } = render(bar());

    expect(onHeightChange).toHaveBeenLastCalledWith(96);

    // ...and as the keyboard closes and opens again.
    mockKeyboardVisible = false;
    rerender(bar());
    mockKeyboardVisible = true;
    rerender(bar());

    expect(screen.queryByTestId("floating-tab-bar")).toBeNull();
    expect(onHeightChange).not.toHaveBeenCalledWith(0);
    expect(onHeightChange).toHaveBeenLastCalledWith(96);
  });
});
