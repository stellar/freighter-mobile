import { fireEvent, render, screen } from "@testing-library/react-native";
import { TokensCollectiblesInline } from "components/screens/SendScreen/components/TokensCollectiblesInline";
import { NETWORKS, TransactionContext } from "config/constants";
import { useCollectiblesStore } from "ducks/collectibles";
import { useBalancesList } from "hooks/useBalancesList";
import { useFilteredCollectibles } from "hooks/useFilteredCollectibles";
import React from "react";
import {
  TouchableOpacity as mockTouchableOpacity,
  View as mockView,
} from "react-native";

const MockTouchableOpacity = mockTouchableOpacity;
const MockView = mockView;

jest.mock("components/BalancesList", () => ({
  BalancesList: ({
    onTokenPress,
  }: {
    onTokenPress?: (tokenId: string) => void;
  }) => (
    <MockTouchableOpacity
      testID="balances-list-token-row"
      onPress={() => onTokenPress?.("native")}
    >
      <MockView />
    </MockTouchableOpacity>
  ),
}));

jest.mock("components/CollectibleImage", () => ({
  CollectibleImage: () => <MockView testID="collectible-image" />,
}));

jest.mock("components/Spinner", () => ({
  __esModule: true,
  default: ({ testID }: { testID?: string }) => <MockView testID={testID} />,
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) =>
      ({
        "balancesList.title": "Tokens",
        "balancesList.error": "Error loading balances",
        "collectiblesGrid.title": "Collectibles",
        "collectiblesGrid.error": "Error loading collectibles",
        "transactionTokenScreen.empty": "No tokens or collectibles to send",
      })[key] || key,
  }),
}));

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      secondary: "#000",
      text: {
        secondary: "#111",
      },
    },
  }),
}));

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: jest.fn(),
}));

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(),
}));

jest.mock("hooks/useFilteredCollectibles", () => ({
  useFilteredCollectibles: jest.fn(),
}));

const mockUseCollectiblesStore =
  useCollectiblesStore as unknown as jest.MockedFunction<any>;
const mockUseBalancesList =
  useBalancesList as unknown as jest.MockedFunction<any>;
const mockUseFilteredCollectibles =
  useFilteredCollectibles as unknown as jest.MockedFunction<any>;

const setupState = ({
  // Tokens
  tokensLoading = false,
  tokensError = null,
  noBalances = false,
  // Collectibles
  collectiblesLoading = false,
  collectiblesError = null,
  visibleCollectibles = [],
}: {
  tokensLoading?: boolean;
  tokensError?: string | null;
  noBalances?: boolean;
  collectiblesLoading?: boolean;
  collectiblesError?: string | null;
  visibleCollectibles?: any[];
}) => {
  mockUseBalancesList.mockReturnValue({
    isLoading: tokensLoading,
    error: tokensError,
    noBalances,
  });
  mockUseCollectiblesStore.mockImplementation((selector: any) =>
    selector({ isLoading: collectiblesLoading, error: collectiblesError }),
  );
  mockUseFilteredCollectibles.mockReturnValue({ visibleCollectibles });
};

const renderComponent = (props = {}) =>
  render(
    <TokensCollectiblesInline
      publicKey="G..."
      network={NETWORKS.TESTNET}
      feeContext={TransactionContext.Send}
      {...props}
    />,
  );

describe("TokensCollectiblesInline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a single spinner while tokens are still loading", () => {
    setupState({ tokensLoading: true, noBalances: true });

    renderComponent();

    expect(
      screen.getByTestId("tokens-collectibles-inline-spinner"),
    ).toBeTruthy();
  });

  it("shows a single spinner while collectibles are still loading", () => {
    setupState({ collectiblesLoading: true, visibleCollectibles: [] });

    renderComponent();

    expect(
      screen.getByTestId("tokens-collectibles-inline-spinner"),
    ).toBeTruthy();
  });

  it("shows the collectibles error when only collectibles fail", () => {
    setupState({ collectiblesError: "failed", noBalances: true });

    renderComponent();

    expect(
      screen.getByTestId("tokens-collectibles-inline-error"),
    ).toBeTruthy();
    expect(screen.getByText("Error loading collectibles")).toBeTruthy();
  });

  it("prioritizes an error over the spinner while the other source is still loading", () => {
    setupState({
      tokensError: "token-failed",
      noBalances: true,
      collectiblesLoading: true,
      visibleCollectibles: [],
    });

    renderComponent();

    expect(screen.queryByTestId("tokens-collectibles-inline-spinner")).toBeNull();
    expect(screen.getByTestId("tokens-collectibles-inline-error")).toBeTruthy();
    expect(screen.getByText("Error loading balances")).toBeTruthy();
  });

  it("prefers the token error over the collectibles error", () => {
    setupState({
      tokensError: "token-failed",
      collectiblesError: "collectibles-failed",
    });

    renderComponent();

    expect(screen.getByText("Error loading balances")).toBeTruthy();
    expect(screen.queryByText("Error loading collectibles")).toBeNull();
  });

  it("shows the combined empty fallback when there are no tokens or collectibles", () => {
    setupState({ noBalances: true, visibleCollectibles: [] });

    renderComponent();

    expect(
      screen.getByText("No tokens or collectibles to send"),
    ).toBeTruthy();
  });

  it("hides the collectibles section when there are no collectibles", () => {
    setupState({ noBalances: false, visibleCollectibles: [] });

    renderComponent();

    expect(screen.getByTestId("balances-list-token-row")).toBeTruthy();
    expect(screen.queryByText("Collectibles")).toBeNull();
    expect(
      screen.queryByText("No tokens or collectibles to send"),
    ).toBeNull();
  });

  it("hides the tokens section when there are no balances", () => {
    setupState({
      noBalances: true,
      visibleCollectibles: [
        {
          collectionAddress: "CABC",
          collectionName: "Cool Collection",
          items: [
            {
              collectionAddress: "CABC",
              tokenId: "42",
              image: "https://example.com/item.png",
              name: "Collectible #42",
            },
          ],
        },
      ],
    });

    renderComponent();

    expect(screen.queryByTestId("balances-list-token-row")).toBeNull();
    expect(screen.getByText("Collectibles")).toBeTruthy();
  });

  it("forwards token and collectible press handlers", () => {
    const onTokenPress = jest.fn();
    const onCollectiblePress = jest.fn();

    setupState({
      visibleCollectibles: [
        {
          collectionAddress: "CABC",
          collectionName: "Cool Collection",
          items: [
            {
              collectionAddress: "CABC",
              tokenId: "42",
              image: "https://example.com/item.png",
              name: "Collectible #42",
            },
          ],
        },
      ],
    });

    renderComponent({ onTokenPress, onCollectiblePress });

    fireEvent.press(screen.getByTestId("balances-list-token-row"));
    expect(onTokenPress).toHaveBeenCalledWith("native");

    fireEvent.press(screen.getByText("Collectible #42"));
    expect(onCollectiblePress).toHaveBeenCalledWith({
      collectionAddress: "CABC",
      tokenId: "42",
    });
  });
});
