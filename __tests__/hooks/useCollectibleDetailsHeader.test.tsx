import { renderHook } from "@testing-library/react-native";
import { useCollectibleDetailsHeader } from "hooks/useCollectibleDetailsHeader";
import { Platform } from "react-native";

// Create mock for navigation
const mockSetOptions = jest.fn();

// Mock all dependencies
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    setOptions: mockSetOptions,
  }),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    network: "testnet",
  }),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: {
      publicKey: "test-public-key",
    },
  }),
}));

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: () => ({
    fetchCollectibles: jest.fn(),
    getCollectible: jest.fn(() => ({
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
    })),
    isLoading: false,
  }),
}));

jest.mock("helpers/stellarExpert", () => ({
  getStellarExpertUrl: jest.fn(() => "https://testnet.stellar.expert"),
}));

jest.mock("hooks/useRightHeader", () => ({
  useRightHeaderMenu: jest.fn(),
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("components/sds/Icon", () => ({
  DotsHorizontal: "DotsHorizontal",
}));

jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(),
}));

describe("useCollectibleDetailsHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Platform, "select").mockReturnValue({
      refreshMetadata: "arrow.clockwise",
      viewOnStellarExpert: "link",
    });
  });

  afterEach(() => {
    (Platform.select as jest.Mock).mockRestore?.();
  });

  const defaultParams = {
    collectionAddress: "test-collection-address",
    collectibleName: "Test NFT",
  };

  it("should return handler functions", () => {
    const { result } = renderHook(() =>
      useCollectibleDetailsHeader(defaultParams),
    );

    expect(result.current).toEqual({
      handleRefreshMetadata: expect.any(Function),
      handleRemoveCollectible: expect.any(Function),
      handleViewOnStellarExpert: expect.any(Function),
    });
  });

  it("should set navigation title", () => {
    renderHook(() => useCollectibleDetailsHeader(defaultParams));

    expect(mockSetOptions).toHaveBeenCalledWith({
      headerTitle: "Test NFT",
    });
  });

  it("should call useRightHeaderMenu", () => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const { useRightHeaderMenu } = require("hooks/useRightHeader");

    renderHook(() => useCollectibleDetailsHeader(defaultParams));

    expect(useRightHeaderMenu).toHaveBeenCalled();
  });

  it("should set fallback title when collectible name is not provided", () => {
    renderHook(() =>
      useCollectibleDetailsHeader({
        collectionAddress: "test-collection",
        collectibleName: undefined,
      }),
    );

    expect(mockSetOptions).toHaveBeenCalledWith({
      headerTitle: "collectibleDetails.title",
    });
  });

  it("should handle refresh metadata", async () => {
    const { result } = renderHook(() =>
      useCollectibleDetailsHeader(defaultParams),
    );

    // Test that the function exists and is callable
    await expect(
      result.current.handleRefreshMetadata(),
    ).resolves.toBeUndefined();
  });

  it("should handle view on stellar expert", async () => {
    const { result } = renderHook(() =>
      useCollectibleDetailsHeader(defaultParams),
    );

    // Test that the function exists and is callable
    await expect(
      result.current.handleViewOnStellarExpert(),
    ).resolves.toBeUndefined();
  });

  it("should call Platform.select for icon configuration", () => {
    renderHook(() => useCollectibleDetailsHeader(defaultParams));

    expect(Platform.select).toHaveBeenCalledWith({
      ios: {
        refreshMetadata: "arrow.clockwise",
        removeCollectible: "trash",
        viewOnStellarExpert: "link",
      },
      android: {
        refreshMetadata: "refresh",
        removeCollectible: "delete",
        viewOnStellarExpert: "link",
      },
    });
  });
});
