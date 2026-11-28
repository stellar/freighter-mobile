import { BLEND_FIXED_POOL_IDS } from "config/blend";
import { NETWORKS } from "config/constants";
import { freighterBackendV2 } from "services/backend";
import {
  getBlendEarnOptions,
  getBlendPools,
  getBlendPositions,
  getBlendSuppliedTokens,
} from "services/blend";

jest.mock("services/backend", () => ({
  freighterBackendV2: { get: jest.fn(), post: jest.fn() },
}));

const mockGet = freighterBackendV2.get as jest.Mock;
const mockPost = freighterBackendV2.post as jest.Mock;
const networkDetails = { network: NETWORKS.PUBLIC } as never;
const POOL_ID = BLEND_FIXED_POOL_IDS[NETWORKS.PUBLIC]!;
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

describe("getBlendPositions", () => {
  const supplyRow = {
    asset_id: USDC_SAC,
    symbol: "USDC",
    name: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    decimals: 7,
    supplied_tokens: "0",
    collateral_tokens: "5001223000",
    total_tokens: "5001223000",
    usd_value: 500.12,
    apy: 0.1694,
    emissions_apr: null,
    interest_earned: "1234000",
    interest_earned_usd: 0.12,
    claimable_blnd: "0",
    claimable_usd: null,
    price_usd: 1,
  };

  it("maps each pool and its supplied tokens, keeping nulls as nulls", async () => {
    mockPost.mockResolvedValue({
      data: {
        data: [
          {
            address: "GABC",
            total_value_usd: 500.12,
            net_apy: 0.1694,
            positions: [
              {
                protocol: "blend",
                id: POOL_ID,
                name: "Fixed v2.1",
                net_usd: 500.12,
                supplied_usd: 500.12,
                borrowed_usd: 0,
                net_apy: null,
                blend: { supply: [supplyRow], borrow: [] },
              },
            ],
          },
        ],
      },
    });

    const result = await getBlendPositions({
      publicKey: "GABC",
      networkDetails,
    });

    expect(result.totalValueUsd).toBe(500.12);
    expect(result.positions).toHaveLength(1);
    const [pool] = result.positions;
    expect(pool.poolId).toBe(POOL_ID);
    expect(pool.name).toBe("Fixed v2.1");
    expect(pool.suppliedUsd).toBe(500.12);
    // null means unavailable; 0 is a real zero. Neither may become the other.
    expect(pool.netApy).toBeNull();
    expect(pool.supply).toEqual([
      {
        assetId: USDC_SAC,
        symbol: "USDC",
        name: supplyRow.name,
        decimals: 7,
        totalTokens: "5001223000",
        usdValue: 500.12,
        apy: 0.1694,
        emissionsApr: null,
        interestEarned: "1234000",
        interestEarnedUsd: 0.12,
        priceUsd: 1,
      },
    ]);
  });

  it("posts the address as a single-element batch", async () => {
    mockPost.mockResolvedValue({ data: { data: [] } });
    await getBlendPositions({ publicKey: "GABC", networkDetails });
    expect(mockPost).toHaveBeenCalledWith(
      "/accounts/positions",
      { addresses: ["GABC"] },
      { params: { network: NETWORKS.PUBLIC } },
    );
  });

  it("returns no positions for an account the indexer doesn't know", async () => {
    mockPost.mockResolvedValue({ data: { data: [] } });
    await expect(
      getBlendPositions({ publicKey: "GABC", networkDetails }),
    ).resolves.toEqual({ totalValueUsd: null, positions: [] });
  });

  const accountWith = (positions: unknown[]) => ({
    data: {
      data: [
        { address: "GABC", total_value_usd: null, net_apy: null, positions },
      ],
    },
  });

  // Unknown, which is not the same as none: a pool with no detail keeps its
  // card, and its interest reads as unknown rather than zero.
  it("keeps a pool without Blend detail, with its tokens unknown", async () => {
    mockPost.mockResolvedValue(
      accountWith([{ protocol: "blend", id: POOL_ID, name: null }]),
    );
    const { positions } = await getBlendPositions({
      publicKey: "GABC",
      networkDetails,
    });
    expect(positions).toHaveLength(1);
    expect(positions[0].supply).toBeNull();
    expect(positions[0].protocol).toBe("blend");
  });

  it("drops a pool the account has fully left", async () => {
    mockPost.mockResolvedValue(
      accountWith([
        {
          protocol: "blend",
          id: POOL_ID,
          name: "Fixed v2.1",
          blend: { supply: [], borrow: [] },
        },
      ]),
    );
    const { positions } = await getBlendPositions({
      publicKey: "GABC",
      networkDetails,
    });
    expect(positions).toEqual([]);
  });

  it("keeps a pool that holds only a borrow", async () => {
    mockPost.mockResolvedValue(
      accountWith([
        {
          protocol: "blend",
          id: POOL_ID,
          name: "Fixed v2.1",
          blend: { supply: [], borrow: [{ asset_id: USDC_SAC }] },
        },
      ]),
    );
    const { positions } = await getBlendPositions({
      publicKey: "GABC",
      networkDetails,
    });
    expect(positions).toHaveLength(1);
    expect(positions[0].supply).toEqual([]);
  });

  it("throws when the payload has no data envelope", async () => {
    mockPost.mockResolvedValue({ data: {} });
    await expect(
      getBlendPositions({ publicKey: "GABC", networkDetails }),
    ).rejects.toThrow("Failed to fetch Blend positions");
  });
});
