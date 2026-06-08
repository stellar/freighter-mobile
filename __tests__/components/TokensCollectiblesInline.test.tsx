import { fireEvent, render, screen } from "@testing-library/react-native";
import { TokensCollectiblesInline } from "components/screens/SendScreen/components/TokensCollectiblesInline";
import { NETWORKS, TransactionContext } from "config/constants";
import { useCollectiblesStore } from "ducks/collectibles";
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
        "collectiblesGrid.title": "Collectibles",
        "collectiblesGrid.error": "Error loading collectibles",
        "collectiblesGrid.empty": "No collectibles",
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

jest.mock("hooks/useFilteredCollectibles", () => ({
  useFilteredCollectibles: jest.fn(),
}));

const mockUseCollectiblesStore =
  useCollectiblesStore as unknown as jest.MockedFunction<any>;
const mockUseFilteredCollectibles =
  useFilteredCollectibles as unknown as jest.MockedFunction<any>;

const setupCollectibleState = ({
  isLoading = false,
  error = null,
  visibleCollectibles = [],
}: {
  isLoading?: boolean;
  error?: string | null;
  visibleCollectibles?: any[];
}) => {
  mockUseCollectiblesStore.mockImplementation((selector: any) =>
    selector({ isLoading, error }),
  );
  mockUseFilteredCollectibles.mockReturnValue({ visibleCollectibles });
};

describe("TokensCollectiblesInline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading spinner while collectibles are loading", () => {
    setupCollectibleState({ isLoading: true, visibleCollectibles: [] });

    render(
      <TokensCollectiblesInline
        publicKey="G..."
        network={NETWORKS.TESTNET}
        feeContext={TransactionContext.Send}
      />,
    );

    expect(screen.getByTestId("collectibles-inline-spinner")).toBeTruthy();
  });

  it("shows collectibles error state", () => {
    setupCollectibleState({ error: "failed", visibleCollectibles: [] });

    render(
      <TokensCollectiblesInline
        publicKey="G..."
        network={NETWORKS.TESTNET}
        feeContext={TransactionContext.Send}
      />,
    );

    expect(screen.getByText("Error loading collectibles")).toBeTruthy();
  });

  it("shows collectibles empty state", () => {
    setupCollectibleState({ visibleCollectibles: [] });

    render(
      <TokensCollectiblesInline
        publicKey="G..."
        network={NETWORKS.TESTNET}
        feeContext={TransactionContext.Send}
      />,
    );

    expect(screen.getByText("No collectibles")).toBeTruthy();
  });

  it("forwards token and collectible press handlers", () => {
    const onTokenPress = jest.fn();
    const onCollectiblePress = jest.fn();

    setupCollectibleState({
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

    render(
      <TokensCollectiblesInline
        publicKey="G..."
        network={NETWORKS.TESTNET}
        onTokenPress={onTokenPress}
        onCollectiblePress={onCollectiblePress}
        feeContext={TransactionContext.Send}
      />,
    );

    fireEvent.press(screen.getByTestId("balances-list-token-row"));
    expect(onTokenPress).toHaveBeenCalledWith("native");

    fireEvent.press(screen.getByText("Collectible #42"));
    expect(onCollectiblePress).toHaveBeenCalledWith({
      collectionAddress: "CABC",
      tokenId: "42",
    });
  });
});
