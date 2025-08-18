import { fireEvent } from "@testing-library/react-native";
import { CollectibleDetailsScreen } from "components/screens/CollectibleDetailsScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Linking } from "react-native";

// Mock the Linking module
jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(),
}));

// Mock the useCollectibles hook
jest.mock("hooks/useCollectibles", () => ({
  useCollectibles: () => ({
    getCollectible: jest.fn(() => ({
      collectionAddress: "test-collection",
      collectionName: "Test Collection",
      tokenId: "123",
      name: "Test NFT",
      image: "https://example.com/image.jpg",
      description: "A test NFT description",
      externalUrl: "https://example.com/nft",
      traits: [
        { name: "Color", value: "Blue" },
        { name: "Rarity", value: "Common" },
      ],
    })),
  }),
}));

// Mock the useAppTranslation hook
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the useColors hook
jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      base: ["#000000", "#ffffff"],
    },
  }),
}));

describe("CollectibleDetailsScreen", () => {
  const mockRoute = {
    params: {
      collectionAddress: "test-collection",
      tokenId: "123",
    },
  };

  const mockNavigation = {
    setOptions: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders collectible details correctly", () => {
    const { getByText } = renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={mockNavigation as any}
      />,
    );

    // Check if the collectible name is displayed
    expect(getByText("Test NFT")).toBeTruthy();

    // Check if the description is displayed
    expect(getByText("A test NFT description")).toBeTruthy();

    // Check if traits are displayed
    expect(getByText("Blue")).toBeTruthy();
    expect(getByText("Common")).toBeTruthy();
    expect(getByText("Color")).toBeTruthy();
    expect(getByText("Rarity")).toBeTruthy();
  });

  it("opens external URL when view button is pressed", () => {
    const mockOpenURL = Linking.openURL as jest.MockedFunction<
      typeof Linking.openURL
    >;
    mockOpenURL.mockResolvedValue(undefined);

    const { getByText } = renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={mockNavigation as any}
      />,
    );

    const viewButton = getByText("collectibleDetails.view");
    fireEvent.press(viewButton);

    expect(mockOpenURL).toHaveBeenCalledWith("https://example.com/nft");
  });

  it("sets navigation title to collectible name", () => {
    renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={mockNavigation as any}
      />,
    );

    expect(mockNavigation.setOptions).toHaveBeenCalledWith({
      headerTitle: "Test NFT",
    });
  });
});
