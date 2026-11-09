import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { CollectiblesGrid } from "components/CollectiblesGrid";
import { getButtonColors } from "components/sds/Button/theme";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { hostParentOf } from "helpers/testUtils";
import en from "i18n/locales/en/translations.json";
import pt from "i18n/locales/pt/translations.json";
import React from "react";
import { StyleSheet } from "react-native";
import { ReactTestInstance } from "react-test-renderer";

// The rest of react-i18next stays real: helpers/testUtils sets up i18n with
// its initReactI18next.
jest.mock("react-i18next", () => ({
  ...jest.requireActual("react-i18next"),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

const mockFetchCollectibles = jest.fn();

// Mutable so each test can shape what the grid sees.
let mockCollections: unknown[] = [];
let mockIsLoading = false;
let mockError: string | null = null;

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: jest.fn((selector?: (s: unknown) => unknown) => {
    const state = {
      collections: mockCollections,
      isLoading: mockIsLoading,
      error: mockError,
      fetchCollectibles: mockFetchCollectibles,
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({ network: "PUBLIC" })),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: { publicKey: "GTESTPUBLICKEY" } }),
}));

// Jest reports no device scheme, so the buttons take DEFAULT_COLOR_SCHEME.
const { secondary } = getButtonColors(DEFAULT_COLOR_SCHEME);

const styleOf = (node: ReactTestInstance | null | undefined) =>
  StyleSheet.flatten(node?.props.style) ?? {};

// Button secondary lg: a 48pt pill with 16pt sides, filled with
// text.primary, as wide as its label. Figma's card draws a 40pt pill;
// Cássio chose lg.
const expectSecondaryLgPill = (button: ReactTestInstance) =>
  expect(styleOf(button)).toMatchObject({
    height: 48,
    paddingLeft: 16,
    paddingRight: 16,
    // The pill: Button rounds every corner by 100pt.
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    borderBottomLeftRadius: 100,
    backgroundColor: secondary.background,
    width: "auto",
  });

// Figma's empty Collectibles tab (?node-id=372-11772) puts the button in the
// card, funded or not.
describe("CollectiblesGrid empty card", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollections = [];
    mockIsLoading = false;
    mockError = null;
  });

  it("invites the user to collect their first NFT", () => {
    render(<CollectiblesGrid />);

    expect(screen.getByTestId("collectibles-empty-state")).toBeTruthy();
    expect(screen.getByText("collectiblesGrid.empty")).toBeTruthy();
    expect(screen.getByText("collectiblesGrid.emptyDescription")).toBeTruthy();
  });

  // The grid is full width, and the collectibles start 12pt under the tab
  // row: Figma has the card 16pt from the screen's edges and 8pt under the
  // row, padded 32pt at its sides.
  it("sits 16pt from the screen's edges and 8pt under the tab row, padded 32pt inside", () => {
    render(<CollectiblesGrid disableInnerScrolling />);

    expect(
      styleOf(screen.getByTestId("collectibles-empty-state")),
    ).toMatchObject({
      marginHorizontal: 16,
      marginTop: -4,
      paddingHorizontal: 32,
      minHeight: 280,
    });
  });

  it("shows Add Collectible whenever it has a handler, as a secondary lg pill", () => {
    const onAddCollectiblePress = jest.fn();
    render(<CollectiblesGrid onAddCollectiblePress={onAddCollectiblePress} />);

    const button = screen.getByTestId("add-collectible-empty-state-button");
    expectSecondaryLgPill(button);
    expect(screen.getByText("collectiblesGrid.emptyButton")).toBeTruthy();

    fireEvent.press(button);
    expect(onAddCollectiblePress).toHaveBeenCalledTimes(1);
  });

  // Figma's frame says "Import Collectible"; Cássio asked for Add, to match
  // the app's other Add actions.
  it("labels the button Add Collectible", () => {
    expect(en.collectiblesGrid.emptyButton).toBe("Add Collectible");
    expect(pt.collectiblesGrid.emptyButton).toBe("Adicionar colecionável");
  });

  it("puts the button inside the card", () => {
    render(<CollectiblesGrid onAddCollectiblePress={jest.fn()} />);

    expect(
      within(screen.getByTestId("collectibles-empty-state")).getByTestId(
        "add-collectible-empty-state-button",
      ),
    ).toBeTruthy();
  });

  // A handler-less button would be a dead end.
  it("shows no button without a handler", () => {
    render(<CollectiblesGrid />);

    expect(screen.getByTestId("collectibles-empty-state")).toBeTruthy();
    expect(
      screen.queryByTestId("add-collectible-empty-state-button"),
    ).toBeNull();
  });

  // Nothing to offer while the grid is still a spinner.
  it("shows no card or button while loading", () => {
    mockIsLoading = true;

    render(<CollectiblesGrid onAddCollectiblePress={jest.fn()} />);

    expect(screen.getByTestId("collectibles-grid-spinner")).toBeTruthy();
    expect(screen.queryByTestId("collectibles-empty-state")).toBeNull();
    expect(
      screen.queryByTestId("add-collectible-empty-state-button"),
    ).toBeNull();
  });

  it("shows the button in the non-scrolling (Home) layout too", () => {
    render(
      <CollectiblesGrid
        disableInnerScrolling
        onAddCollectiblePress={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId("add-collectible-empty-state-button"),
    ).toBeTruthy();
  });

  // An error replaces the empty card, so the error view has to carry the
  // button or a failing fetch leaves the tab with no way to add anything.
  it("keeps the button, the same pill, in the error view", () => {
    mockError = "boom";

    render(
      <CollectiblesGrid
        disableInnerScrolling
        onAddCollectiblePress={jest.fn()}
      />,
    );

    expectSecondaryLgPill(
      screen.getByTestId("add-collectible-empty-state-button"),
    );
    expect(screen.queryByTestId("collectibles-empty-state")).toBeNull();
  });

  it("keeps the button in the error view via the FlatList path too", () => {
    mockError = "boom";

    render(<CollectiblesGrid onAddCollectiblePress={jest.fn()} />);

    expect(
      screen.getByTestId("add-collectible-empty-state-button"),
    ).toBeTruthy();
  });

  it("shows no button in the error view without a handler", () => {
    mockError = "boom";

    render(<CollectiblesGrid disableInnerScrolling />);

    expect(
      screen.queryByTestId("add-collectible-empty-state-button"),
    ).toBeNull();
  });
});

describe("CollectiblesGrid layout", () => {
  const classesOf = (node: ReactTestInstance | null | undefined) =>
    ((node?.props.className ?? "") as string).split(" ");

  const stretches = (node: ReactTestInstance | null | undefined) =>
    classesOf(node).includes("flex-1") ||
    StyleSheet.flatten(node?.props.style)?.flexGrow === 1;

  const buildCollection = (address: string) => ({
    collectionAddress: address,
    collectionName: `Collection ${address}`,
    count: 1,
    items: [
      {
        collectionAddress: address,
        collectionName: `Collection ${address}`,
        tokenId: "1",
        isHidden: false,
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollections = [
      buildCollection("CA"),
      buildCollection("CB"),
      buildCollection("CC"),
    ];
    mockIsLoading = false;
    mockError = null;
  });

  describe("with collections to show", () => {
    // Figma puts 16pt between collections and none after the last, so the
    // gap is the container's: a trailing margin on each collection would
    // stack on whatever follows the last one (Home's Add collectible button).
    // NativeWind doesn't apply classes in tests, and `gap-4` would come out at
    // 14pt with its rem of 14, hence the arbitrary value.
    it("spaces the collections 16pt apart with a gap", () => {
      render(<CollectiblesGrid disableInnerScrolling />);

      const container = hostParentOf(
        screen.getByTestId("collection-section-CA"),
      );

      expect(classesOf(container)).toContain("gap-[16px]");
      // All three share that container.
      expect(hostParentOf(screen.getByTestId("collection-section-CB"))).toBe(
        container,
      );
      expect(hostParentOf(screen.getByTestId("collection-section-CC"))).toBe(
        container,
      );
    });

    // Home ends the grid with an inline button. Stretched, the grid would push
    // it to the bottom of the screen instead of leaving it under the last
    // collection, so only the states with nothing to list fill the screen.
    it("is as tall as its collections instead of stretching", () => {
      render(<CollectiblesGrid disableInnerScrolling />);

      const container = hostParentOf(
        screen.getByTestId("collection-section-CA"),
      );

      expect(stretches(container)).toBe(false);
    });

    it("separates the collections of the scrolling list by 16pt too", () => {
      render(<CollectiblesGrid />);

      const separators = screen.getAllByTestId("collection-separator");

      expect(separators).toHaveLength(2);
      separators.forEach((separator) => {
        expect(classesOf(separator)).toContain("h-[16px]");
      });
    });
  });

  // The loading view fills the space it is given, which keeps the spinner
  // centred under the tabs.
  describe.each([
    [
      "loading",
      () => {
        mockIsLoading = true;
      },
      () => screen.getByTestId("collectibles-grid-spinner"),
      1,
    ],
  ])("while %s", (_name, setup, find, levelsUp) => {
    it("fills the space it is given", () => {
      setup();
      render(<CollectiblesGrid disableInnerScrolling />);

      let wrapper: ReactTestInstance | null | undefined = find();
      for (let level = 0; level < levelsUp; level += 1) {
        wrapper = hostParentOf(wrapper);
      }

      expect(stretches(wrapper)).toBe(true);
    });
  });

  // The empty and error views are as tall as their content, so whatever
  // follows the grid (Home's inline Add collectible button) sits right under
  // them instead of at the bottom of the screen.
  describe.each([
    [
      "empty",
      () => {
        mockCollections = [];
      },
      () => screen.getByTestId("collectibles-empty-state"),
      1,
    ],
    [
      "failed",
      () => {
        mockCollections = [];
        mockError = "boom";
      },
      () => screen.getByText("collectiblesGrid.error"),
      2,
    ],
  ])("while %s", (_name, setup, find, levelsUp) => {
    it("is as tall as its content", () => {
      setup();
      render(<CollectiblesGrid disableInnerScrolling />);

      let wrapper: ReactTestInstance | null | undefined = find();
      for (let level = 0; level < levelsUp; level += 1) {
        wrapper = hostParentOf(wrapper);
      }

      expect(stretches(wrapper)).toBe(false);
    });
  });
});
