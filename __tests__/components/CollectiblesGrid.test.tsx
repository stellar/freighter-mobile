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

  // A button with no handler would be a dead end, so the handler gates it.
  it("renders no CTA when asked but given no handler", () => {
    const { queryByTestId } = render(<CollectiblesGrid showEmptyStateCta />);

    expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
  });

  // The hidden list is a management view — adding from it makes no sense.
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

  // Nothing should be offered while the grid is still a spinner, or the CTA
  // would flash in before we know whether the tab is really empty.
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

  it("renders the error view instead of the CTA when the fetch failed", () => {
    mockError = "boom";

    const { queryByTestId } = render(
      <CollectiblesGrid
        disableInnerScrolling
        showEmptyStateCta
        onAddCollectiblePress={jest.fn()}
      />,
    );

    expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
    expect(queryByTestId("collectibles-empty-state")).toBeNull();
  });
});
