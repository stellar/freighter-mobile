import {
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react-native";
import ChevronDownSvg from "assets/icons/chevron-down.svg";
import ScanCircleSvg from "assets/icons/scan-circle.svg";
import { HEADER_BUTTON_BOX } from "components/layout/CustomHeaderButton";
import Avatar from "components/sds/Avatar";
import { MarbleAvatar } from "components/sds/Avatar/MarbleAvatar";
import Icon from "components/sds/Icon";
import { getThemeColors } from "config/colors";
import { ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { px } from "helpers/dimensions";
import { truncateAddress } from "helpers/stellar";
import { RenderedNode, hostParentOf } from "helpers/testUtils";
import { useHomeHeaders } from "hooks/useHomeHeaders";
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

const PUBLIC_KEY = "GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST5TVOM";
const ACCOUNT_NAME = "Main account";
// 60 characters: more than the header row has room for beside the buttons.
const LONG_ACCOUNT_NAME = "Long account name ".repeat(4).slice(0, 60);

// Jest reports no device scheme, so useColors resolves DEFAULT_COLOR_SCHEME.
const { gray, text } = getThemeColors(DEFAULT_COLOR_SCHEME);

let mockAccount = { accountName: ACCOUNT_NAME, publicKey: PUBLIC_KEY };

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: mockAccount }),
}));

// The labels come back as their keys, so a test can find a button by the key
// the hook asked for.
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

type Navigation = Parameters<typeof useHomeHeaders>[0]["navigation"];

/** What the hook hands the tab navigator, which HomeScreenHeader calls. */
interface HomeHeaderOptions {
  headerLeft: () => React.ReactNode;
  headerRight: () => React.ReactNode;
}

// NativeWind doesn't apply classes in tests, so layout is read off the class
// names.
const classesOf = (node?: { props: { className?: unknown } } | null) =>
  typeof node?.props.className === "string"
    ? node.props.className.split(" ")
    : [];

/** Runs the hook against a navigation that records what it is given. */
const setUp = (accountName = ACCOUNT_NAME) => {
  mockAccount = { accountName, publicKey: PUBLIC_KEY };

  const setOptions = jest.fn();
  const navigate = jest.fn();
  const onAccountPress = jest.fn();
  const onConnectedAppsPress = jest.fn();

  renderHook(() =>
    useHomeHeaders({
      navigation: { navigate, setOptions } as unknown as Navigation,
      onAccountPress,
      onConnectedAppsPress,
    }),
  );

  const [{ headerLeft, headerRight }] = setOptions.mock.calls[0] as [
    HomeHeaderOptions,
  ];

  return {
    headerLeft,
    headerRight,
    navigate,
    onAccountPress,
    onConnectedAppsPress,
  };
};

// The switcher's own element: NativeWind classes stay on it, and not on the
// native view it renders.
const switcher = () => screen.UNSAFE_getByType(TouchableOpacity);

/** The account switcher, as the nav bar's left side draws it. */
const renderSwitcher = (accountName?: string) => {
  const { headerLeft, ...rest } = setUp(accountName);
  render(<>{headerLeft()}</>);
  return rest;
};

/** The Scan and Connected Apps buttons, as the nav bar's right side draws them. */
const renderButtons = () => {
  const { headerRight, ...rest } = setUp();
  render(<>{headerRight()}</>);
  return rest;
};

describe("useHomeHeaders", () => {
  describe("account switcher", () => {
    it("shows no address line", () => {
      renderSwitcher();

      expect(screen.queryByText(truncateAddress(PUBLIC_KEY))).toBeNull();
    });

    it("shows the account name in Text/LG/600 on one line", () => {
      renderSwitcher();

      const name = screen.getByText(ACCOUNT_NAME);

      expect(StyleSheet.flatten(name.props.style)).toMatchObject({
        fontSize: 18,
        lineHeight: 26,
        fontWeight: "600",
        color: text.primary,
      });
      expect(name.props.numberOfLines).toBe(1);
    });

    it("uses a 32pt avatar", () => {
      renderSwitcher();

      // The avatar's own view is the outermost native view under it.
      const [avatarView] = screen
        .UNSAFE_getByType(Avatar)
        .findAll((node) => typeof node.type === "string", { deep: false });

      expect(classesOf(avatarView)).toEqual(
        expect.arrayContaining(["w-[32px]", "h-[32px]"]),
      );
      // ... and the identicon is drawn to fill it.
      expect(screen.UNSAFE_getByType(MarbleAvatar).props.size).toBe(32);
    });

    it("gives the avatar the bar's button height and keeps it on the bar's inset", () => {
      renderSwitcher();

      const [avatarView] = screen
        .UNSAFE_getByType(Avatar)
        .findAll((node) => typeof node.type === "string", { deep: false });
      const avatarBox = hostParentOf(avatarView);

      // The row is as tall as its tallest child. The avatar is a fixed 32pt
      // and the bar's buttons scale, so on its own it would make Home's row
      // taller than the other tabs' on narrow screens. Its box takes the bar's
      // button height (pxValue is the identity in Jest, so the height comes
      // off HEADER_BUTTON_BOX) and centres it vertically. It sets no width and
      // doesn't centre it horizontally, so the avatar's left edge stays on the
      // bar's inset at every screen width.
      expect(StyleSheet.flatten(avatarBox?.props.style)).toEqual({
        height: HEADER_BUTTON_BOX.height,
      });
      expect(classesOf(avatarBox)).toContain("justify-center");
      expect(classesOf(avatarBox)).not.toContain("items-center");
    });

    it("extends its touch area 10pt above and below, as the header buttons do", () => {
      // Without the address line it's only the bar's 32pt row tall (about
      // 30pt on an iPhone SE). The bar pads at least 45pt above the row and
      // 24pt below it, inside its own bounds, so the slop takes taps on iOS's
      // new architecture too, which drops touches outside an ancestor.
      renderSwitcher();

      expect(switcher().props.hitSlop).toEqual({ top: 10, bottom: 10 });
    });

    it("lets a tap on the avatar reach the switcher", () => {
      renderSwitcher();

      // The avatar draws on a Skia canvas, a native view that would take the
      // touch itself; Avatar leaves touches to the switcher around it. Skia's
      // Jest setup renders Canvas as a View, so read it off the drawing.
      expect(
        screen.UNSAFE_getByType(MarbleAvatar).parent?.props.pointerEvents,
      ).toBe("none");
    });

    it("draws a 16pt chevron-down with a 2pt stroke in Gray/9", () => {
      renderSwitcher();

      // Every .svg is the same mock in Jest, and the mock turns a string
      // width into NaN, so the size is read off the svg's own props. The
      // chevron is the only svg here: the avatar draws with Skia.
      const chevron = screen.UNSAFE_getByType(ChevronDownSvg);

      expect(chevron.props.width).toBe(px(16));
      expect(chevron.props.height).toBe(px(16));
      // Icon turns points into the 24-unit grid: 2 × 24 / 16.
      expect(chevron.props.strokeWidth).toBe(3);
      expect(chevron.props.color).toBe(gray[9]);
      // The bold chevron was the old one; Figma's is the plain one.
      expect(screen.UNSAFE_queryByType(Icon.ChevronDown)).not.toBeNull();
      expect(screen.UNSAFE_queryByType(Icon.ChevronDownBold)).toBeNull();
    });

    it("ellipsizes a long name before the buttons", () => {
      renderSwitcher(LONG_ACCOUNT_NAME);

      const name = screen.getByText(LONG_ACCOUNT_NAME);
      const nameWrapper = hostParentOf(name);
      const nameAndChevronRow = hostParentOf(nameWrapper);
      const rowWrapper = hostParentOf(nameAndChevronRow);

      expect(name.props.numberOfLines).toBe(1);
      // numberOfLines only ellipsizes where the name's width is capped. That
      // takes the name's wrapper, the wrapper around the name-and-chevron row
      // and the switcher itself to give way to the buttons.
      expect(classesOf(nameWrapper)).toContain("shrink");
      expect(classesOf(rowWrapper)).toContain("shrink");
      expect(classesOf(switcher())).toContain("flex-1");
    });

    it("keeps 8pt between the avatar and the name", () => {
      renderSwitcher();

      expect(classesOf(switcher())).toContain("gap-[8px]");
    });

    it("leaves 12pt between the switcher and the buttons", () => {
      renderSwitcher();

      expect(classesOf(switcher())).toContain("mr-[12px]");
    });

    it("keeps 4pt between the name and the chevron", () => {
      renderSwitcher();

      const nameWrapper = hostParentOf(screen.getByText(ACCOUNT_NAME));

      expect(classesOf(hostParentOf(nameWrapper))).toContain("gap-[4px]");
    });

    it("keeps its test ID, its account-name label and what it does", () => {
      const { onAccountPress } = renderSwitcher();

      // A screen reader announces the switcher by the account name.
      const button = screen.getByTestId("home-account-switcher");
      expect(button.props.accessibilityLabel).toBe(ACCOUNT_NAME);

      fireEvent.press(button);

      expect(onAccountPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("header buttons", () => {
    it("keeps 12pt between the header buttons", () => {
      renderButtons();

      // The container is all the right side draws, so it is the render's root.
      const container = screen.toJSON() as RenderedNode;

      expect(classesOf(container)).toContain("gap-[12px]");
    });

    it("extends each button's touch area 6pt into the gap between them", () => {
      renderButtons();

      // 6pt from each button fills the 12pt gap, so the two areas meet in its
      // middle without overlapping.
      ["home-screen-scan-button", "home-screen-connected-apps-button"].forEach(
        (testID) =>
          expect(screen.getByTestId(testID).props.hitSlop).toEqual({
            top: 10,
            bottom: 10,
            left: 6,
            right: 6,
          }),
      );
    });

    it("draws 24pt icons in secondary text inside the bar's 32pt boxes", () => {
      renderButtons();

      // Both buttons' icons: every .svg is the same mock in Jest.
      const icons = screen.UNSAFE_getAllByType(ScanCircleSvg);

      expect(icons).toHaveLength(2);
      icons.forEach((icon) => {
        expect(icon.props.width).toBe(px(24));
        expect(icon.props.height).toBe(px(24));
        expect(icon.props.color).toBe(text.secondary);
      });
      ["home-screen-scan-button", "home-screen-connected-apps-button"].forEach(
        (testID) =>
          expect(
            StyleSheet.flatten(screen.getByTestId(testID).props.style),
          ).toMatchObject({ width: 32, height: 32 }),
      );
    });

    it("keeps the test IDs, the labels and what each button does", () => {
      const { navigate, onConnectedAppsPress } = renderButtons();

      const scan = screen.getByTestId("home-screen-scan-button");
      const connectedApps = screen.getByTestId(
        "home-screen-connected-apps-button",
      );
      expect(scan.props.accessibilityLabel).toBe("homeScanner.title");
      expect(connectedApps.props.accessibilityLabel).toBe(
        "connectedApps.title",
      );

      fireEvent.press(scan);

      expect(navigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN,
        { initialTab: "scan" },
      );

      fireEvent.press(connectedApps);

      expect(onConnectedAppsPress).toHaveBeenCalledTimes(1);
    });
  });

  it("floats the header over Home, so content scrolls up under its fade", () => {
    const setOptions = jest.fn();
    renderHook(() =>
      useHomeHeaders({
        navigation: {
          navigate: jest.fn(),
          setOptions,
        } as unknown as Navigation,
        onAccountPress: jest.fn(),
        onConnectedAppsPress: jest.fn(),
      }),
    );

    expect(setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ headerShown: true, headerTransparent: true }),
    );
  });
});
