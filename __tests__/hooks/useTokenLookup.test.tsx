// Now import after all mocks are set up
import { renderHook, act } from "@testing-library/react-hooks";
import BigNumber from "bignumber.js";
import { NETWORKS } from "config/constants";
import {
  TokenTypeWithCustomToken,
  HookStatus,
  PricedBalance,
} from "config/types";
import { useTokenLookup } from "hooks/useTokenLookup";

// Mock helpers
jest.mock("helpers/balances", () => {
  const originalModule = jest.requireActual("helpers/balances");
  return {
    ...originalModule,
    formatTokenIdentifier: (tokenId: string) => {
      const [tokenCode, issuer] = tokenId.split(":");
      return { tokenCode, issuer };
    },
  };
});

jest.mock("helpers/soroban", () => ({
  isContractId: (value: string) => value.startsWith("C") && value.length === 56,
  getNativeContractDetails: () => ({
    contract: "native-contract-id",
    issuer: "native-issuer-id",
    code: "XLM",
    domain: "stellar.org",
  }),
}));

jest.mock("helpers/splitVerifiedTokens", () => ({
  splitVerifiedTokens: ({ tokens }: { tokens: any[]; network: string }) =>
    // Simple mock: return all tokens as verified for testing
    Promise.resolve({
      verified: tokens,
      unverified: [],
    }),
}));

jest.mock("ducks/verifiedTokens", () => ({
  useVerifiedTokensStore: {
    getState: () => ({
      getVerifiedTokens: jest.fn().mockResolvedValue([]),
    }),
  },
}));

// Mock useDebounce - use a simple implementation that just returns the callback
jest.mock("hooks/useDebounce", () => ({
  __esModule: true,
  default: (callback: () => void) => callback,
}));

// Mock API services - don't use jest.fn() since it's causing issues
jest.mock("services/backend", () => ({
  handleContractLookup: (contractId: string) => {
    // Return mock data based on input
    if (
      contractId === "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"
    ) {
      return Promise.resolve({
        tokenCode: "TOKEN",
        issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        domain: "soroban.stellar.org",
      });
    }
    return Promise.reject(new Error("Contract lookup failed"));
  },
}));

jest.mock("services/stellarExpert", () => ({
  searchToken: (searchTerm: string) => {
    // Return mock data based on the search term
    if (searchTerm === "USDC") {
      return Promise.resolve({
        _embedded: {
          records: [
            {
              asset:
                "USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
              domain: "circle.com",
            },
            {
              asset: "XLM",
              domain: "stellar.org",
            },
          ],
        },
      });
    }
    if (searchTerm === "test") {
      return Promise.resolve({
        _embedded: {
          records: [
            {
              asset:
                "FOO-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
              domain: "example.com",
            },
            {
              asset:
                "USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
              domain: "circle.com",
            },
          ],
        },
      });
    }
    if (searchTerm === "error") {
      return Promise.reject(new Error("Search failed"));
    }
    return Promise.resolve({
      _embedded: {
        records: [],
      },
    });
  },
}));

// Helper function to wait for all promises to resolve
const flushPromises = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 500);
  });

describe("useTokenLookup", () => {
  const mockNetwork = NETWORKS.TESTNET;
  const mockPublicKey =
    "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP";

  // Create proper PricedBalance mock objects
  const mockBalanceItems: (PricedBalance & { id: string })[] = [
    {
      id: "XLM:native",
      total: new BigNumber("100"),
      available: new BigNumber("99"),
      minimumBalance: new BigNumber("1"),
      buyingLiabilities: "0",
      sellingLiabilities: "0",
      token: {
        code: "XLM",
        type: "native" as const,
      },
      tokenCode: "XLM",
      fiatCode: "USD",
      fiatTotal: new BigNumber("50"),
      displayName: "Stellar Lumens",
      currentPrice: new BigNumber("0.5"),
      percentagePriceChange24h: new BigNumber("2.5"),
    },
    {
      id: "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      total: new BigNumber("50"),
      available: new BigNumber("50"),
      limit: new BigNumber("1000000"),
      buyingLiabilities: "0",
      sellingLiabilities: "0",
      token: {
        code: "USDC",
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
        issuer: {
          key: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        },
      },
      tokenCode: "USDC",
      fiatCode: "USD",
      fiatTotal: new BigNumber("50"),
      displayName: "USD Coin",
      currentPrice: new BigNumber("1"),
      percentagePriceChange24h: new BigNumber("0"),
    },
  ];

  it("should initialize with default values", () => {
    const { result } = renderHook(() =>
      useTokenLookup({
        network: mockNetwork,
        publicKey: mockPublicKey,
        balanceItems: mockBalanceItems,
      }),
    );

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.status).toBe(HookStatus.IDLE);
  });

  it("should reset search state when resetSearch is called", async () => {
    const { result } = renderHook(() =>
      useTokenLookup({
        network: mockNetwork,
        publicKey: mockPublicKey,
        balanceItems: mockBalanceItems,
      }),
    );

    // Set some search state
    await act(async () => {
      result.current.handleSearch("test");
      await flushPromises();
    });

    // Now reset
    act(() => {
      result.current.resetSearch();
    });

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.verifiedTokens).toEqual([]);
    expect(result.current.unverifiedTokens).toEqual([]);
    expect(result.current.status).toBe(HookStatus.IDLE);
  });

  it("should handle error when search fails", async () => {
    const { result } = renderHook(() =>
      useTokenLookup({
        network: mockNetwork,
        publicKey: mockPublicKey,
        balanceItems: mockBalanceItems,
      }),
    );

    await act(async () => {
      result.current.handleSearch("error");
      await flushPromises();
    });

    expect(result.current.status).toBe(HookStatus.ERROR);
  });

  it("should clear results when empty search term is provided", () => {
    const { result } = renderHook(() =>
      useTokenLookup({
        network: mockNetwork,
        publicKey: mockPublicKey,
        balanceItems: mockBalanceItems,
      }),
    );

    act(() => {
      result.current.handleSearch("");
    });

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.verifiedTokens).toEqual([]);
    expect(result.current.unverifiedTokens).toEqual([]);
    expect(result.current.status).toBe(HookStatus.IDLE);
  });

  it("should return formatted search results for a valid term", async () => {
    const { result } = renderHook(() =>
      useTokenLookup({
        network: mockNetwork,
        publicKey: mockPublicKey,
        balanceItems: mockBalanceItems,
      }),
    );

    await act(async () => {
      result.current.handleSearch("USDC");
      await flushPromises();
    });

    expect(result.current.status).toBe(HookStatus.SUCCESS);
    expect(result.current.searchResults.length).toBeGreaterThan(0);

    const usdcResult = result.current.searchResults.find(
      (t) => t.tokenCode === "USDC",
    );
    expect(usdcResult).toBeDefined();
    expect(usdcResult?.hasTrustline).toBe(true);
  });

  it("should handle request cancellation correctly", async () => {
    const { result } = renderHook(() =>
      useTokenLookup({
        network: mockNetwork,
        publicKey: mockPublicKey,
        balanceItems: mockBalanceItems,
      }),
    );

    await act(async () => {
      result.current.handleSearch("test");
      result.current.handleSearch("USDC");
      await flushPromises();
    });

    expect(result.current.status).toBe(HookStatus.SUCCESS);
    const tokens = result.current.searchResults.map((t) => t.tokenCode);
    expect(tokens).toContain("USDC");
    expect(tokens).not.toContain("FOO");
  });

  it("should handle contract ID search", async () => {
    const { result } = renderHook(() =>
      useTokenLookup({
        network: mockNetwork,
        publicKey: mockPublicKey,
        balanceItems: mockBalanceItems,
      }),
    );

    await act(async () => {
      result.current.handleSearch(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      );
      await flushPromises();
    });

    expect(result.current.status).toBe(HookStatus.SUCCESS);
    expect(result.current.searchResults[0].tokenCode).toBe("TOKEN");
  });
});
