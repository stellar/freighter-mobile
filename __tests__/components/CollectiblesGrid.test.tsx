import { fireEvent, render } from "@testing-library/react-native";
import {
  CollectibleFilterType,
  CollectiblesGrid,
} from "components/CollectiblesGrid";
import React from "react";

jest.mock("react-i18next", () => ({
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

describe("CollectiblesGrid empty-state CTA", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollections = [];
    mockIsLoading = false;
    mockError = null;
  });

  it("renders no CTA by default, so callers without a floating pill are unchanged", () => {
    const { getByTestId, queryByTestId } = render(<CollectiblesGrid />);

    expect(getByTestId("collectibles-empty-state")).toBeTruthy();
    expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
  });

  it("renders the CTA when asked, and wires it to the handler", () => {
    const onAddCollectiblePress = jest.fn();
    const { getByTestId } = render(
      <CollectiblesGrid
        showEmptyStateCta
        onAddCollectiblePress={onAddCollectiblePress}
      />,
    );

    const cta = getByTestId("add-collectible-empty-state-button");
    expect(cta).toBeTruthy();

    fireEvent.press(cta);
    expect(onAddCollectiblePress).toHaveBeenCalledTimes(1);
  });

  // A handler-less button would be a dead end.
  it("renders no CTA when asked but given no handler", () => {
    const { queryByTestId } = render(<CollectiblesGrid showEmptyStateCta />);

    expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
  });

  // The hidden list is a management view, not a place to add.
  it("never renders the CTA on the hidden-collectibles list", () => {
    const { queryByTestId } = render(
      <CollectiblesGrid
        type={CollectibleFilterType.HIDDEN}
        showEmptyStateCta
        onAddCollectiblePress={jest.fn()}
      />,
    );

    expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
  });

  // Nothing to offer while the grid is still a spinner.
  it("renders no empty state or CTA while loading", () => {
    mockIsLoading = true;

    const { queryByTestId, getByTestId } = render(
      <CollectiblesGrid showEmptyStateCta onAddCollectiblePress={jest.fn()} />,
    );

    expect(getByTestId("collectibles-grid-spinner")).toBeTruthy();
    expect(queryByTestId("collectibles-empty-state")).toBeNull();
    expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
  });

  it("renders the CTA in the non-scrolling (Home) layout too", () => {
    const { getByTestId } = render(
      <CollectiblesGrid
        disableInnerScrolling
        showEmptyStateCta
        onAddCollectiblePress={jest.fn()}
      />,
    );

    expect(getByTestId("add-collectible-empty-state-button")).toBeTruthy();
  });

  // An error replaces the empty state, so the error view has to carry the CTA
  // or a failing fetch leaves the tab with no way to add anything.
  it("keeps the CTA in the error view", () => {
    mockError = "boom";

    const { getByTestId, queryByTestId } = render(
      <CollectiblesGrid
        disableInnerScrolling
        showEmptyStateCta
        onAddCollectiblePress={jest.fn()}
      />,
    );

    expect(getByTestId("add-collectible-empty-state-button")).toBeTruthy();
    expect(queryByTestId("collectibles-empty-state")).toBeNull();
  });

  it("keeps the CTA in the error view via the FlatList path too", () => {
    mockError = "boom";

    const { getByTestId } = render(
      <CollectiblesGrid showEmptyStateCta onAddCollectiblePress={jest.fn()} />,
    );

    expect(getByTestId("add-collectible-empty-state-button")).toBeTruthy();
  });

  it("renders no CTA in the error view when the caller did not ask for one", () => {
    mockError = "boom";

    const { queryByTestId } = render(<CollectiblesGrid disableInnerScrolling />);

    expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
  });
});
