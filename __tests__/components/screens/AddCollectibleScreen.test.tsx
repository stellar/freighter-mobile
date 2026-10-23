/* eslint-disable global-require, @typescript-eslint/no-var-requires, react/react-in-jsx-scope */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import AddCollectibleScreen from "components/screens/AddCollectibleScreen/AddCollectibleScreen";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

type AddCollectibleScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.ADD_COLLECTIBLE_SCREEN
>;

const mockPresent = jest.fn();
const mockDismiss = jest.fn();

// Render the sheet body inline so its contents can be asserted on; the real
// modal only mounts its children once presented, which the test can't drive.
jest.mock("components/BottomSheet", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({
      modalRef,
      customContent,
    }: {
      modalRef: React.MutableRefObject<unknown>;
      customContent: React.ReactNode;
    }) => {
      // eslint-disable-next-line no-param-reassign
      modalRef.current = { present: mockPresent, dismiss: mockDismiss };
      return <View testID="mock-bottom-sheet">{customContent}</View>;
    },
  };
});

jest.mock("components/CollectibleImage", () => {
  const { View } = require("react-native");
  return {
    CollectibleImage: () => <View testID="collectible-image" />,
  };
});

const mockUnhideCollectible = jest.fn();

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: () => ({
    addCollectible: jest.fn(),
    isLoading: false,
    checkCollectibleExists: () => false,
    unhideCollectible: mockUnhideCollectible,
  }),
}));

let mockHiddenCollectibles: unknown[] = [];

jest.mock("hooks/useFilteredCollectibles", () => ({
  useFilteredCollectibles: () => ({
    visibleCollectibles: [],
    hiddenCollectibles: mockHiddenCollectibles,
  }),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: {
      publicKey: "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK",
    },
  }),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "testnet" }),
}));

const mockNavigate = jest.fn();

const navigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
} as unknown as AddCollectibleScreenProps["navigation"];

const route = {
  params: undefined,
} as unknown as AddCollectibleScreenProps["route"];

const hiddenCollection = {
  collectionAddress: "CCOLLECTION",
  collectionName: "Soroban Domains",
  collectionSymbol: "SD",
  count: 1,
  items: [
    {
      collectionAddress: "CCOLLECTION",
      collectionName: "Soroban Domains",
      tokenId: "102510",
      name: "charles.xlm",
      image: "https://example.com/charles.png",
      isHidden: true,
    },
  ],
};

describe("AddCollectibleScreen - Show hidden sheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHiddenCollectibles = [];
  });

  it("opens the hidden collectibles sheet instead of navigating", () => {
    const { getByTestId } = renderWithProviders(
      <AddCollectibleScreen navigation={navigation} route={route} />,
    );

    fireEvent.press(getByTestId("add-collectible-show-hidden"));

    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows the empty state when nothing is hidden", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <AddCollectibleScreen navigation={navigation} route={route} />,
    );

    expect(getByTestId("hidden-collectibles-sheet-empty")).toBeTruthy();
    expect(getByText("No hidden collectibles")).toBeTruthy();
  });

  it("names a collectible without metadata Token #<id>, without repeating the id", () => {
    mockHiddenCollectibles = [
      {
        ...hiddenCollection,
        items: [{ ...hiddenCollection.items[0], name: undefined }],
      },
    ];

    const { getByText, queryByText } = renderWithProviders(
      <AddCollectibleScreen navigation={navigation} route={route} />,
    );

    expect(getByText("Token #102510")).toBeTruthy();
    expect(queryByText("#102510")).toBeNull();
  });

  it("lists hidden collectibles and unhides one from its row", async () => {
    mockHiddenCollectibles = [hiddenCollection];
    mockUnhideCollectible.mockResolvedValue(undefined);

    const { getByText, getByTestId } = renderWithProviders(
      <AddCollectibleScreen navigation={navigation} route={route} />,
    );

    expect(getByText("charles.xlm")).toBeTruthy();
    expect(getByText("#102510")).toBeTruthy();

    act(() => {
      fireEvent.press(
        getByTestId("hidden-collectibles-sheet-unhide-CCOLLECTION:102510"),
      );
    });

    await waitFor(() => {
      expect(mockUnhideCollectible).toHaveBeenCalledWith({
        publicKey: "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK",
        network: "testnet",
        contractId: "CCOLLECTION",
        tokenId: "102510",
      });
    });
    // Stays open so several can be unhidden in a row
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(getByText("Collectible unhidden")).toBeTruthy();
  });
});
