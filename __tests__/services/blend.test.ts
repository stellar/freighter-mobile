import { NETWORKS } from "config/constants";
import { freighterBackendV2 } from "services/backend";
import {
  getBlendEarnOptions,
  getBlendPools,
  getBlendSuppliedTokens,
} from "services/blend";

jest.mock("services/backend", () => ({
  freighterBackendV2: { get: jest.fn(), post: jest.fn() },
}));

const mockGet = freighterBackendV2.get as jest.Mock;
const mockPost = freighterBackendV2.post as jest.Mock;
const networkDetails = { network: NETWORKS.PUBLIC } as never;
const POOL_ID = "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD";
const USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

beforeEach(() => jest.clearAllMocks());

describe("getBlendEarnOptions", () => {
  it("maps snake_case to camelCase and preserves nulls as nulls", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          options: [
            {
              asset_id: USDC_SAC,
              symbol: "USDC",
              name: null,
              decimals: 7,
              pools: [
                {
                  id: POOL_ID,
                  name: "Fixed",
                  supply_apy: 0.0523,
                  emissions_supply_apr: null,
                  supplied_usd: 0,
                },
              ],
            },
          ],
        },
      },
    });

    const [option] = await getBlendEarnOptions({ networkDetails });

    expect(option.assetId).toBe(USDC_SAC);
    expect(option.decimals).toBe(7);
    // null means unavailable; 0 is a real zero. Neither may become the other.
    expect(option.pools[0].emissionsSupplyApr).toBeNull();
    expect(option.pools[0].suppliedUsd).toBe(0);
  });

  it("sends the network as a query param", async () => {
    mockGet.mockResolvedValue({ data: { data: { options: [] } } });
    await getBlendEarnOptions({ networkDetails });
    expect(mockGet).toHaveBeenCalledWith("/protocols/blend/earn-options", {
      params: { network: NETWORKS.PUBLIC },
    });
  });

  it("throws when the payload has no data envelope", async () => {
    mockGet.mockResolvedValue({ data: {} });
    await expect(getBlendEarnOptions({ networkDetails })).rejects.toThrow();
  });

  it("tolerates a missing options array", async () => {
    mockGet.mockResolvedValue({ data: { data: {} } });
    await expect(getBlendEarnOptions({ networkDetails })).resolves.toEqual([]);
  });
});

describe("getBlendPools", () => {
  it("normalises an absent backstop_usd to null", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          pools: [
            {
              id: POOL_ID,
              name: "Fixed",
              status: "ACTIVE",
              supplied_usd: 50050000,
              borrowed_usd: null,
              interest_apy: 0.05,
              net_apy: 0.07,
              reserves: [],
            },
          ],
        },
      },
    });

    const [pool] = await getBlendPools({ networkDetails });
    expect(pool.backstopUsd).toBeNull();
    expect(pool.suppliedUsd).toBe(50050000);
    expect(pool.borrowedUsd).toBeNull();
  });
});

describe("getBlendSuppliedTokens", () => {
  const positionsResponse = (supply: unknown[]) => ({
    data: {
      data: [
        {
          address: "G...",
          total_value_usd: 1,
          net_apy: 0.05,
          positions: [{ protocol: "blend", id: POOL_ID, blend: { supply } }],
        },
      ],
    },
  });

  it("reads total_tokens, not supplied_tokens", async () => {
    // Deposits use SupplyCollateral, so the position lands in collateral_tokens
    // and supplied_tokens is always "0". Reading it would report no position.
    mockPost.mockResolvedValue(
      positionsResponse([
        {
          asset_id: USDC_SAC,
          supplied_tokens: "0",
          collateral_tokens: "5000000000",
          total_tokens: "5000000000",
        },
      ]),
    );

    await expect(
      getBlendSuppliedTokens({
        publicKey: "G...",
        poolId: POOL_ID,
        assetId: USDC_SAC,
        networkDetails,
      }),
    ).resolves.toBe("5000000000");
  });

  it("returns '0' when the account has no row for that asset", async () => {
    mockPost.mockResolvedValue(positionsResponse([]));
    await expect(
      getBlendSuppliedTokens({
        publicKey: "G...",
        poolId: POOL_ID,
        assetId: USDC_SAC,
        networkDetails,
      }),
    ).resolves.toBe("0");
  });

  it("posts the address as a single-element batch", async () => {
    mockPost.mockResolvedValue(positionsResponse([]));
    await getBlendSuppliedTokens({
      publicKey: "GABC",
      poolId: POOL_ID,
      assetId: USDC_SAC,
      networkDetails,
    });
    expect(mockPost).toHaveBeenCalledWith(
      "/accounts/positions",
      { addresses: ["GABC"] },
      { params: { network: NETWORKS.PUBLIC } },
    );
  });
});
