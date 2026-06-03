import { renderHook } from "@testing-library/react-hooks";
import { NETWORKS } from "config/constants";
import { useSwapTokenListsPrewarm } from "hooks/useSwapTokenListsPrewarm";
import { InteractionManager } from "react-native";

const mockGetStellarExpertTop = jest.fn();
const mockGetVerified = jest.fn();
const mockScanBulkWithCache = jest.fn();

jest.mock("ducks/stellarExpertTopTokens", () => ({
  useStellarExpertTopTokensStore: {
    getState: () => ({
      getStellarExpertTopTokens: mockGetStellarExpertTop,
    }),
  },
}));
jest.mock("ducks/verifiedTokens", () => ({
  useVerifiedTokensStore: {
    getState: () => ({ getVerifiedTokens: mockGetVerified }),
  },
}));
jest.mock("ducks/blockaidTokenScans", () => ({
  useBlockaidTokenScansStore: {
    getState: () => ({ scanBulkWithCache: mockScanBulkWithCache }),
  },
}));

// Stub InteractionManager to run callbacks immediately and return a cancellable.
beforeAll(() => {
  jest
    .spyOn(InteractionManager, "runAfterInteractions")
    .mockImplementation((cb: any) => {
      if (typeof cb === "function") cb();
      return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() } as any;
    });
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("useSwapTokenListsPrewarm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches top-tokens and verified in parallel after deferred interaction", async () => {
    mockGetStellarExpertTop.mockResolvedValue({
      _embedded: { records: [{ asset: "XLM" }] },
      _links: {},
    });
    mockGetVerified.mockResolvedValue([]);

    renderHook(() => useSwapTokenListsPrewarm(NETWORKS.PUBLIC));

    await Promise.resolve();
    await Promise.resolve();

    expect(mockGetStellarExpertTop).toHaveBeenCalledWith({
      network: NETWORKS.PUBLIC,
    });
    expect(mockGetVerified).toHaveBeenCalledWith({ network: NETWORKS.PUBLIC });
  });

  it("skips Blockaid scan when top-tokens fetch returns null", async () => {
    mockGetStellarExpertTop.mockResolvedValue(null);
    mockGetVerified.mockResolvedValue([{ issuer: "G…" }]);

    renderHook(() => useSwapTokenListsPrewarm(NETWORKS.PUBLIC));
    await Promise.resolve();
    await Promise.resolve();

    expect(mockScanBulkWithCache).not.toHaveBeenCalled();
  });

  it("skips Blockaid scan when verified fetch returns null", async () => {
    mockGetStellarExpertTop.mockResolvedValue({
      _embedded: { records: [{ asset: "XLM" }] },
      _links: {},
    });
    mockGetVerified.mockResolvedValue(null);

    renderHook(() => useSwapTokenListsPrewarm(NETWORKS.PUBLIC));
    await Promise.resolve();
    await Promise.resolve();

    expect(mockScanBulkWithCache).not.toHaveBeenCalled();
  });

  it("fires Blockaid scan with the intersection address list when both fetches succeed", async () => {
    mockGetStellarExpertTop.mockResolvedValue({
      _embedded: {
        records: [
          {
            asset:
              "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
          {
            asset:
              "AQUA-GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          },
        ],
      },
      _links: {},
    });
    mockGetVerified.mockResolvedValue([
      {
        issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        name: "USDC",
        code: "USDC",
        domain: "circle.com",
      },
    ]);
    mockScanBulkWithCache.mockResolvedValue({ results: {} });

    renderHook(() => useSwapTokenListsPrewarm(NETWORKS.PUBLIC));
    await new Promise((r) => {
      setImmediate(r);
    });

    expect(mockScanBulkWithCache).toHaveBeenCalledTimes(1);
    const arg = mockScanBulkWithCache.mock.calls[0][0];
    expect(arg.network).toBe(NETWORKS.PUBLIC);
    // intersection has 1 record (USDC) so addressList has 1 entry
    expect(arg.addressList.length).toBeGreaterThanOrEqual(1);
  });
});
