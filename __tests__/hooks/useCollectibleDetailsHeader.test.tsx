import { renderHook } from "@testing-library/react-native";
import { useCollectibleDetailsHeader } from "hooks/useCollectibleDetailsHeader";
import { Platform } from "react-native";

// Create mock for navigation
const mockSetOptions = jest.fn();

// Mock the useToast hook
const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const mockGoBack = jest.fn();
const mockPopToTop = jest.fn();

// Mock all dependencies
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    setOptions: mockSetOptions,
    goBack: mockGoBack,
    popToTop: mockPopToTop,
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

const mockHideCollectible = jest.fn();
const mockUnhideCollectible = jest.fn();

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
      isHidden: false,
    })),
    hideCollectible: mockHideCollectible,
    unhideCollectible: mockUnhideCollectible,
    isLoading: false,
  }),
}));

jest.mock("helpers/stellarExpert", () => ({
  getStellarExpertUrl: jest.fn(() => "https://testnet.stellar.expert"),
}));

jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({
    open: jest.fn().mockResolvedValue(undefined),
    isAvailable: jest.fn().mockResolvedValue(true),
  }),
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
      hideCollectible: "eye.slash",
      showCollectible: "eye",
    });
  });

  afterEach(() => {
    (Platform.select as jest.Mock).mockRestore?.();
  });

  const defaultParams = {
    collectionAddress: "test-collection-address",
    collectibleName: "Test NFT",
    tokenId: "test-token-id",
  };

  it("should return handler functions", () => {
    const { result } = renderHook(() =>
      useCollectibleDetailsHeader(defaultParams),
    );

    expect(result.current).toEqual({
      handleRefreshMetadata: expect.any(Function),
      handleRemoveCollectible: expect.any(Function),
      handleViewOnStellarExpert: expect.any(Function),
      handleSaveToPhotos: expect.any(Function),
      handleHideCollectible: expect.any(Function),
      handleShowCollectible: expect.any(Function),
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
        tokenId: "test-token-id",
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
        saveToPhotos: "square.and.arrow.down",
        hideCollectible: "eye.slash",
        showCollectible: "eye",
      },
      android: {
        refreshMetadata: "refresh",
        removeCollectible: "delete",
        viewOnStellarExpert: "link",
        saveToPhotos: "place_item",
        hideCollectible: "visibility_off",
        showCollectible: "visibility",
      },
    });
  });

  it("should handle hide collectible", async () => {
    mockHideCollectible.mockResolvedValue(undefined);
    mockGoBack.mockClear();
    mockShowToast.mockClear();

    const { result } = renderHook(() =>
      useCollectibleDetailsHeader(defaultParams),
    );

    await result.current.handleHideCollectible();

    expect(mockHideCollectible).toHaveBeenCalledWith({
      publicKey: "test-public-key",
      network: "testnet",
      contractId: "test-collection-address",
      tokenId: "test-token-id",
    });
    expect(mockGoBack).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "collectibleDetails.hideSuccess",
      variant: "success",
      toastId: "hide-collectible-success",
    });
  });

  it("should handle show collectible", async () => {
    mockUnhideCollectible.mockResolvedValue(undefined);
    mockPopToTop.mockClear();

    const { result } = renderHook(() =>
      useCollectibleDetailsHeader(defaultParams),
    );

    await result.current.handleShowCollectible();

    expect(mockUnhideCollectible).toHaveBeenCalledWith({
      publicKey: "test-public-key",
      network: "testnet",
      contractId: "test-collection-address",
      tokenId: "test-token-id",
    });
    expect(mockPopToTop).toHaveBeenCalled();
  });
});
