import { fireEvent } from "@testing-library/react-native";
import { CollectibleDetailsScreen } from "components/screens/CollectibleDetailsScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock the useAppTranslation hook
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the useInAppBrowser hook
const mockOpenInAppBrowser = jest.fn();
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({
    open: mockOpenInAppBrowser,
    isAvailable: jest.fn(() => Promise.resolve(true)),
  }),
}));

// Mock the useColors hook
jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      base: ["#000000", "#ffffff"],
      text: {
        secondary: "#666666",
      },
      foreground: {
        primary: "#000000",
      },
    },
  }),
}));

// Mock the useRightHeaderMenu hook
jest.mock("hooks/useRightHeader", () => ({
  useRightHeaderMenu: jest.fn(),
}));

// Mock the useAuthenticationStore hook
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    network: "testnet",
    setSignInMethod: jest.fn(),
  }),
  getLoginType: jest.fn((biometryType) => {
    if (!biometryType) return "password";
    if (biometryType === "FaceID" || biometryType === "Face") return "face";
    if (biometryType === "TouchID" || biometryType === "Fingerprint")
      return "fingerprint";
    return "password";
  }),
}));

// Mock the useGetActiveAccount hook
jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: {
      publicKey: "test-public-key",
    },
  }),
}));

// Mock the useGetActiveAccount hook
jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: {
      publicKey: "test-public-key",
    },
  }),
}));

const mockGetCollectible = jest.fn(() => ({
  name: "Test Collectible",
  collectionName: "Test Collection",
  tokenId: "123",
  image: "https://example.com/image.jpg",
  description: "Test description",
  traits: [
    { name: "Color", value: "Blue" },
    { name: "Rarity", value: "Common" },
  ],
  externalUrl: "https://example.com",
}));

// Mock the useCollectiblesStore hook
jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: () => ({
    fetchCollectibles: jest.fn(),
    getCollectible: mockGetCollectible,
    isLoading: false,
  }),
}));

const mockSaveSelectedCollectibleDetails = jest.fn();
const mockSaveSelectedTokenId = jest.fn();
jest.mock("ducks/transactionSettings", () => ({
  useTransactionSettingsStore: () => ({
    saveSelectedCollectibleDetails: mockSaveSelectedCollectibleDetails,
    saveSelectedTokenId: mockSaveSelectedTokenId,
  }),
}));

// Mock the getStellarExpertUrl helper
jest.mock("helpers/stellarExpert", () => ({
  getStellarExpertUrl: jest.fn(() => "https://testnet.stellar.expert"),
}));

// Mock the logger
jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Create a mock navigation object
const mockNavigationObject = {
  setOptions: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  reset: jest.fn(),
  dispatch: jest.fn(),
  canGoBack: jest.fn(),
  isFocused: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

// Mock the useNavigation hook
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => mockNavigationObject,
}));

describe("CollectibleDetailsScreen", () => {
  const mockRoute = {
    params: {
      collectionAddress: "test-collection",
      tokenId: "123",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders collectible details correctly", () => {
    const { getByText } = renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={{} as any}
      />,
    );

    // Check if the collectible name is displayed
    expect(getByText("Test Collectible")).toBeTruthy();

    // Check if the description is displayed
    expect(getByText("Test description")).toBeTruthy();

    // Check if traits are displayed
    expect(getByText("Blue")).toBeTruthy();
    expect(getByText("Common")).toBeTruthy();
    expect(getByText("Color")).toBeTruthy();
    expect(getByText("Rarity")).toBeTruthy();
  });

  it("opens external URL when view button is pressed", () => {
    mockOpenInAppBrowser.mockClear();
    mockOpenInAppBrowser.mockResolvedValue(undefined);

    const { getByText } = renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={{} as any}
      />,
    );

    const viewButton = getByText("collectibleDetails.view");
    fireEvent.press(viewButton);

    expect(mockOpenInAppBrowser).toHaveBeenCalledWith("https://example.com");
  });

  it("sets navigation title to collectible name", () => {
    renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={{} as any}
      />,
    );

    expect(mockNavigationObject.setOptions).toHaveBeenCalledWith({
      headerTitle: "Test Collectible",
    });
  });

  it("renders the Send button", () => {
    const { getByText } = renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={mockNavigationObject as any}
      />,
    );

    const sendButton = getByText("tokenDetailsScreen.send");
    expect(sendButton).toBeTruthy();
  });

  it("navigates to send flow when Send button is pressed", () => {
    mockNavigationObject.navigate.mockClear();
    mockSaveSelectedCollectibleDetails.mockClear();

    const collectibleData = mockGetCollectible();

    const { getByText } = renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={mockNavigationObject as any}
      />,
    );

    const sendButton = getByText("tokenDetailsScreen.send");
    fireEvent.press(sendButton);

    expect(mockSaveSelectedCollectibleDetails).toHaveBeenCalledWith(
      collectibleData,
    );

    expect(mockNavigationObject.navigate).toHaveBeenCalledWith(
      "SendPaymentStack",
      {
        screen: "SendSearchContactsScreen",
      },
    );
  });

  it("renders View and Send buttons in a row when externalUrl exists", () => {
    const { getByText } = renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={mockNavigationObject as any}
      />,
    );

    expect(getByText("collectibleDetails.view")).toBeTruthy();
    expect(getByText("tokenDetailsScreen.send")).toBeTruthy();
  });

  it("renders only Send button when externalUrl is not present", () => {
    mockGetCollectible.mockReturnValueOnce({
      name: "Test Collectible",
      collectionName: "Test Collection",
      tokenId: "123",
      image: "https://example.com/image.jpg",
      description: "Test description",
      traits: [
        { name: "Color", value: "Blue" },
        { name: "Rarity", value: "Common" },
      ],
      externalUrl: "",
    });

    const { getByText, queryByText } = renderWithProviders(
      <CollectibleDetailsScreen
        route={mockRoute as any}
        navigation={mockNavigationObject as any}
      />,
    );

    expect(getByText("tokenDetailsScreen.send")).toBeTruthy();
    expect(queryByText("collectibleDetails.view")).toBeNull();
  });
});
