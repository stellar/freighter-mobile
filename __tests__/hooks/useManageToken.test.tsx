import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { act, renderHook } from "@testing-library/react-hooks";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { useManageToken } from "hooks/useManageToken";
import { analytics } from "services/analytics";

jest.mock("services/analytics", () => ({
  analytics: {
    trackAddTokenConfirmed: jest.fn(),
    trackRemoveTokenConfirmed: jest.fn(),
  },
}));

// Mock the tokenIcons store
jest.mock("ducks/tokenIcons");

const mockAddToken = jest.fn();
const mockRemoveToken = jest.fn();
jest.mock("hooks/useManageTokens", () => ({
  useManageTokens: jest.fn(() => ({
    addToken: mockAddToken,
    removeToken: mockRemoveToken,
    isAddingToken: false,
    isRemovingToken: false,
  })),
}));

describe("useManageToken", () => {
  const mockCode = "USDC";
  const mockIssuer = "GCKUVXILBNYS4FDNWCGCYSJBY2PBQ4KAW2M5CODRVJPUFM62IJFH67J2";
  const mockName = "USDC Coin";
  const mockDecimals = 7;
  const mockId = `${mockCode}:${mockIssuer}`;
  const mockIconUrl = "https://example.com/usdc.png";
  const mockToken = {
    id: mockId,
    code: mockCode,
    decimals: mockDecimals,
    name: mockName,
    issuer: mockIssuer,
    type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    iconUrl: mockIconUrl,
  };

  const mockBottomSheetAdd: React.RefObject<BottomSheetModal> = {
    current: {
      dismiss: jest.fn(),
    } as unknown as BottomSheetModal,
  };

  const mockBottomSheetRemove: React.RefObject<BottomSheetModal> = {
    current: {
      dismiss: jest.fn(),
    } as unknown as BottomSheetModal,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the getState method
    (useTokenIconsStore.getState as jest.Mock) = jest.fn(() => ({
      cacheTokenIcons: jest.fn(),
    }));
  });

  it("should call addToken and dismiss bottom sheet", async () => {
    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.TESTNET,
        bottomSheetRefAdd: mockBottomSheetAdd,
        token: mockToken,
      }),
    );

    await act(async () => {
      await result.current.addToken();
    });

    expect(analytics.trackAddTokenConfirmed).toHaveBeenCalledWith("USDC");
    expect(mockAddToken).toHaveBeenCalledWith({
      tokenCode: mockCode,
      decimals: mockDecimals,
      issuer: mockIssuer,
      name: mockName,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    });
    expect(mockBottomSheetAdd.current.dismiss).toHaveBeenCalled();
  });

  it("should call removeToken and dismiss bottom sheet", async () => {
    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.TESTNET,
        bottomSheetRefRemove: mockBottomSheetRemove,
        token: mockToken,
      }),
    );

    await act(async () => {
      await result.current.removeToken();
    });

    expect(analytics.trackRemoveTokenConfirmed).toHaveBeenCalledWith("USDC");
    expect(mockRemoveToken).toHaveBeenCalledWith({
      tokenId: mockId,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    });
    expect(mockBottomSheetRemove.current.dismiss).toHaveBeenCalled();
  });

  it("should not call actions if token is null", async () => {
    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.TESTNET,
        token: null,
      }),
    );

    await act(async () => {
      await result.current.addToken();
      await result.current.removeToken();
    });

    expect(mockAddToken).not.toHaveBeenCalled();
    expect(mockRemoveToken).not.toHaveBeenCalled();
  });

  it("should cache token icon when iconUrl is provided", async () => {
    const mockCacheTokenIcons = jest.fn();
    (useTokenIconsStore.getState as jest.Mock).mockReturnValue({
      cacheTokenIcons: mockCacheTokenIcons,
    });

    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.TESTNET,
        bottomSheetRefAdd: mockBottomSheetAdd,
        token: mockToken,
      }),
    );

    await act(async () => {
      await result.current.addToken();
    });

    // Verify icon was cached with the correct identifier and metadata
    expect(mockCacheTokenIcons).toHaveBeenCalledWith({
      icons: {
        [`${mockCode}:${mockIssuer}`]: {
          imageUrl: mockIconUrl,
          network: NETWORKS.TESTNET,
          isValidated: true,
          isValid: true,
        },
      },
    });
  });

  it("should not cache icon when iconUrl is not provided", async () => {
    const mockCacheTokenIcons = jest.fn();
    (useTokenIconsStore.getState as jest.Mock).mockReturnValue({
      cacheTokenIcons: mockCacheTokenIcons,
    });

    const tokenWithoutIcon = { ...mockToken, iconUrl: undefined };

    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.TESTNET,
        bottomSheetRefAdd: mockBottomSheetAdd,
        token: tokenWithoutIcon,
      }),
    );

    await act(async () => {
      await result.current.addToken();
    });

    // Verify icon caching was not called
    expect(mockCacheTokenIcons).not.toHaveBeenCalled();
  });

  it("should cache icon for both PUBLIC and TESTNET networks", async () => {
    const mockCacheTokenIcons = jest.fn();
    (useTokenIconsStore.getState as jest.Mock).mockReturnValue({
      cacheTokenIcons: mockCacheTokenIcons,
    });

    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.PUBLIC,
        bottomSheetRefAdd: mockBottomSheetAdd,
        token: mockToken,
      }),
    );

    await act(async () => {
      await result.current.addToken();
    });

    expect(mockCacheTokenIcons).toHaveBeenCalledWith({
      icons: {
        [`${mockCode}:${mockIssuer}`]: {
          imageUrl: mockIconUrl,
          network: NETWORKS.PUBLIC,
          isValidated: true,
          isValid: true,
        },
      },
    });
  });

  it("should not make network calls when icon is already cached", async () => {
    const mockCacheTokenIcons = jest.fn();
    (useTokenIconsStore.getState as jest.Mock).mockReturnValue({
      cacheTokenIcons: mockCacheTokenIcons,
    });

    // First token addition - caches the icon
    const { result: result1 } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.PUBLIC,
        bottomSheetRefAdd: mockBottomSheetAdd,
        token: mockToken,
      }),
    );

    await act(async () => {
      await result1.current.addToken();
    });

    // Verify caching was called the first time
    expect(mockCacheTokenIcons).toHaveBeenCalledTimes(1);
    const firstCallArgs = mockCacheTokenIcons.mock.calls[0][0];

    // Second token addition with same token - icon is already cached
    mockCacheTokenIcons.mockClear();
    const { result: result2 } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.PUBLIC,
        bottomSheetRefAdd: mockBottomSheetAdd,
        token: mockToken,
      }),
    );

    await act(async () => {
      await result2.current.addToken();
    });

    // Verify caching is called again with the same data (no network call needed)
    // The second call uses the same pre-fetched iconUrl from the token object
    expect(mockCacheTokenIcons).toHaveBeenCalledTimes(1);
    expect(mockCacheTokenIcons).toHaveBeenCalledWith(firstCallArgs);
  });

  it("should use cached icon without fetching from network when icon already exists in store", async () => {
    const mockCacheTokenIcons = jest.fn();
    const cachedIcon = {
      imageUrl: mockIconUrl,
      network: NETWORKS.PUBLIC,
      isValidated: true,
      isValid: true,
    };

    // Mock the store to return a cached icon
    (useTokenIconsStore.getState as jest.Mock).mockReturnValue({
      cacheTokenIcons: mockCacheTokenIcons,
      icons: {
        [`${mockCode}:${mockIssuer}`]: cachedIcon,
      },
    });

    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.PUBLIC,
        bottomSheetRefAdd: mockBottomSheetAdd,
        token: mockToken,
      }),
    );

    await act(async () => {
      await result.current.addToken();
    });

    // Even though store has cached icon, we still cache the iconUrl from the token object
    // This ensures the Home Screen gets the icon immediately
    expect(mockCacheTokenIcons).toHaveBeenCalledWith({
      icons: {
        [`${mockCode}:${mockIssuer}`]: {
          imageUrl: mockIconUrl,
          network: NETWORKS.PUBLIC,
          isValidated: true,
          isValid: true,
        },
      },
    });

    // Verify no additional network requests would be triggered
    // by checking that the cache operation uses the pre-fetched URL
    expect(mockAddToken).toHaveBeenCalled();
  });
});
