import {
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native";
import {
  TabType,
  TokensCollectiblesTabs,
} from "components/TokensCollectiblesTabs";
import { getThemeColors } from "config/colors";
import { NETWORKS } from "config/constants";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { hostParentOf } from "helpers/testUtils";
import React from "react";
import { StyleSheet, TouchableOpacity, View as mockView } from "react-native";
import { ReactTestInstance, ReactTestRendererJSON } from "react-test-renderer";

const MockView = mockView;

jest.mock("components/BalancesList", () => ({
  BalancesList: () => <MockView testID="balances-list" />,
}));

// Records the props each render hands the grid.
const mockGridProps = jest.fn();

jest.mock("components/CollectiblesGrid", () => ({
  CollectiblesGrid: (props: Record<string, unknown>) => {
    mockGridProps(props);
    return <MockView testID="collectibles-grid" />;
  },
}));

const mockTranslations: Record<string, string> = {
  "balancesList.title": "Tokens",
  "collectiblesGrid.title": "Collectibles",
  "balancesList.addTokenButton": "Add token",
  "collectiblesGrid.addCollectibleButton": "Add collectible",
};

// One function for every render, as i18next hands out: the component memoises
// its contents on `t`, so a new `t` per render would hide a missing
// dependency from the rerender tests.
const mockT = (key: string) => mockTranslations[key] || key;

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: mockT }),
}));

type TabsProps = Partial<React.ComponentProps<typeof TokensCollectiblesTabs>>;

// Jest reports no device scheme, so useColors and useTheme resolve
// DEFAULT_COLOR_SCHEME.
const { gray, text } = getThemeColors(DEFAULT_COLOR_SCHEME);

const tabs = (props: TabsProps = {}) => (
  <TokensCollectiblesTabs
    publicKey="G..."
    network={NETWORKS.TESTNET}
    {...props}
  />
);

const renderTabs = (props: TabsProps = {}) => render(tabs(props));

// A TouchableOpacity doesn't pass `className` on to its native view, so a
// tab's classes are read off the element itself. NativeWind doesn't apply
// classes in tests; they are arbitrary values on purpose, because its rem is
// 14 here and `py-2` would come out at 7pt, not Figma's 8.
const tabElement = (testID: "tab-tokens" | "tab-collectibles") =>
  screen
    .UNSAFE_getAllByType(TouchableOpacity)
    .find(({ props }) => props.testID === testID) as ReactTestInstance;

const classesOfTab = (testID: "tab-tokens" | "tab-collectibles") =>
  (tabElement(testID).props.className as string).split(" ");

const labelStyle = (label: string) =>
  StyleSheet.flatten(screen.getByText(label).props.style);

// Every test ID on screen, in the order the views are laid out.
const testIDsInOrder = () => {
  const ids: string[] = [];
  const visit = (node: ReactTestRendererJSON | string) => {
    if (typeof node === "string") return;
    if (typeof node.props.testID === "string") ids.push(node.props.testID);
    node.children?.forEach(visit);
  };
  const tree = screen.toJSON();
  (Array.isArray(tree) ? tree : [tree]).forEach((node) => {
    if (node) visit(node);
  });
  return ids;
};

describe("TokensCollectiblesTabs", () => {
  it("renders the Tokens and Collectibles tab headers", () => {
    renderTabs();

    expect(screen.getByTestId("tab-tokens")).toBeTruthy();
    expect(screen.getByTestId("tab-collectibles")).toBeTruthy();
  });

  describe("tab row", () => {
    it("shows tab labels in Text/LG/600, primary when active and Gray/9 when not", () => {
      renderTabs();

      expect(labelStyle("Tokens")).toMatchObject({
        fontSize: 18,
        fontWeight: "600",
        color: text.primary,
      });
      expect(labelStyle("Collectibles")).toMatchObject({
        fontSize: 18,
        fontWeight: "600",
        color: gray[9],
      });
    });

    it("swaps the label colours when the other tab is selected", () => {
      renderTabs();

      fireEvent.press(screen.getByTestId("tab-collectibles"));

      expect(labelStyle("Collectibles")).toMatchObject({ color: text.primary });
      expect(labelStyle("Tokens")).toMatchObject({ color: gray[9] });

      fireEvent.press(screen.getByTestId("tab-tokens"));

      expect(labelStyle("Tokens")).toMatchObject({ color: text.primary });
      expect(labelStyle("Collectibles")).toMatchObject({ color: gray[9] });
    });

    it("has no underline", () => {
      renderTabs();

      // The lilac underline was a `border-b-2` that went transparent when the
      // tab wasn't selected, so no tab keeps any border class in either state.
      const hasBorder = (name: string) => name.startsWith("border");

      expect(classesOfTab("tab-tokens").filter(hasBorder)).toEqual([]);
      expect(classesOfTab("tab-collectibles").filter(hasBorder)).toEqual([]);

      fireEvent.press(screen.getByTestId("tab-collectibles"));

      expect(classesOfTab("tab-tokens").filter(hasBorder)).toEqual([]);
      expect(classesOfTab("tab-collectibles").filter(hasBorder)).toEqual([]);
    });

    it("pads each tab 8pt above and below, and none at its sides", () => {
      renderTabs();

      (["tab-tokens", "tab-collectibles"] as const).forEach((testID) => {
        const classes = classesOfTab(testID);

        expect(classes).toContain("py-[8px]");
        // The 16pt between the labels comes from the row's gap alone.
        expect(classes.filter((name) => /^px-/.test(name))).toEqual([]);
      });
    });

    // Figma's two frames start their lists at different distances under the
    // tab row (9pt for tokens, 12pt for collectibles), so each tab's contents
    // own that distance and the row keeps no margin of its own.
    it("sets the row 16pt in from the sides, with 16pt between the tabs and no margin below", () => {
      renderTabs();

      const row = hostParentOf(screen.getByTestId("tab-tokens"));
      const classes = row?.props.className.split(" ");

      expect(hostParentOf(screen.getByTestId("tab-collectibles"))).toBe(row);
      expect(classes).toEqual(
        expect.arrayContaining(["flex-row", "gap-[16px]"]),
      );
      expect(
        classes.filter((name: string) => /^-?m[trblxy]?-/.test(name)),
      ).toEqual([]);
      expect(StyleSheet.flatten(row?.props.style)).toMatchObject({
        paddingHorizontal: 16,
      });
    });

    it("keeps the tabs' roles, selected state and test IDs", () => {
      renderTabs();

      expect(screen.getByTestId("tab-tokens").props.accessibilityRole).toBe(
        "tab",
      );
      expect(screen.getByTestId("tab-tokens").props.accessibilityState).toEqual(
        expect.objectContaining({ selected: true }),
      );
      expect(
        screen.getByTestId("tab-collectibles").props.accessibilityState,
      ).toEqual(expect.objectContaining({ selected: false }));

      fireEvent.press(screen.getByTestId("tab-collectibles"));

      expect(screen.getByTestId("tab-tokens").props.accessibilityState).toEqual(
        expect.objectContaining({ selected: false }),
      );
      expect(
        screen.getByTestId("tab-collectibles").props.accessibilityState,
      ).toEqual(expect.objectContaining({ selected: true }));
    });
  });

  describe("contents", () => {
    it("keeps the token list's 24pt side padding", () => {
      renderTabs();

      expect(
        StyleSheet.flatten(
          hostParentOf(screen.getByTestId("balances-list"))?.props.style,
        ),
      ).toMatchObject({ paddingHorizontal: 24 });
    });

    // CollectionSection pads its own sides, so the grid gets the full width and
    // only the button below it is inset, to line up with the token list's.
    it("gives the collectibles grid the full width and insets its Add button 24pt", () => {
      renderTabs({
        defaultTab: TabType.COLLECTIBLES,
        showAddCollectibleButton: true,
        onAddCollectiblePress: jest.fn(),
      });

      const contents = hostParentOf(screen.getByTestId("collectibles-grid"));
      const buttonBox = hostParentOf(
        screen.getByTestId("home-add-collectible-button"),
      );

      expect(hostParentOf(buttonBox)).toBe(contents);
      expect(
        StyleSheet.flatten(contents?.props.style)?.paddingHorizontal,
      ).toBeUndefined();
      expect(StyleSheet.flatten(buttonBox?.props.style)).toMatchObject({
        paddingHorizontal: 24,
      });
    });

    it("starts the token list 9pt under the tab row", () => {
      renderTabs();

      expect(
        hostParentOf(
          screen.getByTestId("balances-list"),
        )?.props.className.split(" "),
      ).toContain("pt-[9px]");
    });

    it("starts the collectibles 12pt under the tab row", () => {
      renderTabs({ defaultTab: TabType.COLLECTIBLES });

      expect(
        hostParentOf(
          screen.getByTestId("collectibles-grid"),
        )?.props.className.split(" "),
      ).toContain("pt-[12px]");
    });

    // The loading and empty states fill the screen below the tab row (the
    // spinner sits centred in it), so the contents have to stretch to it. A
    // populated list opts out of stretching itself (BalancesList's and
    // CollectiblesGrid's own tests), which leaves the Add button right under
    // its last row instead of at the bottom of the screen.
    it.each([
      ["tokens", TabType.TOKENS, "balances-list"],
      ["collectibles", TabType.COLLECTIBLES, "collectibles-grid"],
    ])(
      "stretches the %s contents to fill the screen",
      (_name, defaultTab, testID) => {
        renderTabs({ defaultTab });

        expect(
          hostParentOf(screen.getByTestId(testID))?.props.className.split(" "),
        ).toContain("flex-1");
      },
    );
  });

  describe("Add token button", () => {
    it("shows after the token list when asked for", () => {
      renderTabs({ showAddTokenButton: true, onAddTokenPress: jest.fn() });

      expect(screen.getByTestId("home-add-token-button")).toBeTruthy();
      expect(screen.getByText("Add token")).toBeTruthy();

      const ids = testIDsInOrder();

      expect(ids).toContain("balances-list");
      expect(ids.indexOf("home-add-token-button")).toBeGreaterThan(
        ids.indexOf("balances-list"),
      );
    });

    it.each([
      ["without showAddTokenButton", { onAddTokenPress: jest.fn() }],
      ["without onAddTokenPress", { showAddTokenButton: true }],
      ["without either", {}],
    ])("is left out %s", (_case, props) => {
      renderTabs(props);

      expect(screen.queryByTestId("home-add-token-button")).toBeNull();
    });

    it("calls onAddTokenPress when pressed", async () => {
      const onAddTokenPress = jest.fn();
      renderTabs({ showAddTokenButton: true, onAddTokenPress });

      await userEvent.press(screen.getByTestId("home-add-token-button"));

      expect(onAddTokenPress).toHaveBeenCalledTimes(1);
    });

    // Each list ends with its own button, so the two never show together.
    it("shows with the Tokens tab only, never next to Add collectible", () => {
      renderTabs({
        showAddTokenButton: true,
        onAddTokenPress: jest.fn(),
        showAddCollectibleButton: true,
        onAddCollectiblePress: jest.fn(),
      });

      expect(screen.getByTestId("home-add-token-button")).toBeTruthy();
      expect(screen.queryByTestId("home-add-collectible-button")).toBeNull();

      fireEvent.press(screen.getByTestId("tab-collectibles"));

      expect(screen.getByTestId("home-add-collectible-button")).toBeTruthy();
      expect(screen.queryByTestId("home-add-token-button")).toBeNull();
    });

    it("follows the props as they change", () => {
      const onAddTokenPress = jest.fn();
      const { rerender } = renderTabs({ onAddTokenPress });

      expect(screen.queryByTestId("home-add-token-button")).toBeNull();

      rerender(tabs({ onAddTokenPress, showAddTokenButton: true }));

      expect(screen.getByTestId("home-add-token-button")).toBeTruthy();

      rerender(tabs({ onAddTokenPress, showAddTokenButton: false }));

      expect(screen.queryByTestId("home-add-token-button")).toBeNull();
    });
  });

  describe("Add collectible button", () => {
    const collectiblesTab = { defaultTab: TabType.COLLECTIBLES };

    // The grid's empty card carries its own button whenever it has the
    // handler, funded or not, so there's no flag to pass along with it.
    it("hands the grid the Add handler for its empty card, with no flag", () => {
      const onAddCollectiblePress = jest.fn();
      renderTabs({ ...collectiblesTab, onAddCollectiblePress });

      const gridProps = mockGridProps.mock.lastCall?.[0];

      expect(gridProps).toMatchObject({ onAddCollectiblePress });
      expect(gridProps).not.toHaveProperty("showEmptyStateCta");
    });

    it("shows after the collectibles grid when asked for, 12pt below it", () => {
      renderTabs({
        ...collectiblesTab,
        showAddCollectibleButton: true,
        onAddCollectiblePress: jest.fn(),
      });

      expect(screen.getByTestId("home-add-collectible-button")).toBeTruthy();
      expect(screen.getByText("Add collectible")).toBeTruthy();

      const ids = testIDsInOrder();

      expect(ids).toContain("collectibles-grid");
      expect(ids.indexOf("home-add-collectible-button")).toBeGreaterThan(
        ids.indexOf("collectibles-grid"),
      );
      expect(
        hostParentOf(screen.getByTestId("home-add-collectible-button"))?.props
          .className,
      ).toContain("mt-[12px]");
    });

    it.each([
      [
        "without showAddCollectibleButton",
        { onAddCollectiblePress: jest.fn() },
      ],
      ["without onAddCollectiblePress", { showAddCollectibleButton: true }],
      ["without either", {}],
    ])("is left out %s", (_case, props) => {
      renderTabs({ ...collectiblesTab, ...props });

      expect(screen.queryByTestId("home-add-collectible-button")).toBeNull();
    });

    it("calls onAddCollectiblePress when pressed", async () => {
      const onAddCollectiblePress = jest.fn();
      renderTabs({
        ...collectiblesTab,
        showAddCollectibleButton: true,
        onAddCollectiblePress,
      });

      await userEvent.press(screen.getByTestId("home-add-collectible-button"));

      expect(onAddCollectiblePress).toHaveBeenCalledTimes(1);
    });

    it("shows once the Collectibles tab is selected, not before", () => {
      renderTabs({
        showAddCollectibleButton: true,
        onAddCollectiblePress: jest.fn(),
      });

      expect(screen.queryByTestId("home-add-collectible-button")).toBeNull();

      fireEvent.press(screen.getByTestId("tab-collectibles"));

      expect(screen.getByTestId("home-add-collectible-button")).toBeTruthy();
    });

    it("follows the props as they change", () => {
      const onAddCollectiblePress = jest.fn();
      const { rerender } = renderTabs({
        ...collectiblesTab,
        onAddCollectiblePress,
      });

      expect(screen.queryByTestId("home-add-collectible-button")).toBeNull();

      rerender(
        tabs({
          ...collectiblesTab,
          onAddCollectiblePress,
          showAddCollectibleButton: true,
        }),
      );

      expect(screen.getByTestId("home-add-collectible-button")).toBeTruthy();

      rerender(
        tabs({
          ...collectiblesTab,
          onAddCollectiblePress,
          showAddCollectibleButton: false,
        }),
      );

      expect(screen.queryByTestId("home-add-collectible-button")).toBeNull();
    });
  });
});
