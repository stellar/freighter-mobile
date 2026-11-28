import { hasDepositLanded } from "components/screens/PositionsScreen/helpers/awaitedDeposit";
import { BlendPoolPosition } from "config/blendTypes";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { usePositionsStore } from "ducks/positions";
import { getBlendPositions } from "services/blend";

jest.mock("services/blend", () => ({
  getBlendPositions: jest.fn(),
  getBlendPools: jest.fn(),
  getBlendEarnOptions: jest.fn(),
}));

const mockGetBlendPositions = getBlendPositions as jest.Mock;
const POOL_ID = "CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO";
const USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const networkDetails = mapNetworkToNetworkDetails(NETWORKS.PUBLIC);

const pool = (totalTokens = "5000000000"): BlendPoolPosition => ({
  protocol: "blend",
  poolId: POOL_ID,
  name: "Fixed v2.1",
  netUsd: 500,
  suppliedUsd: 500,
  netApy: 0.1,
  supply: [
    {
      assetId: USDC_SAC,
      symbol: "USDC",
      name: null,
      decimals: 7,
      totalTokens,
      usdValue: 500,
      apy: 0.1,
      emissionsApr: null,
      interestEarned: "0",
      interestEarnedUsd: 0,
      priceUsd: 1,
    },
  ],
});

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("usePositionsStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePositionsStore.getState().reset();
  });

  it("stores the account's positions once read", async () => {
    mockGetBlendPositions.mockResolvedValue({
      totalValueUsd: 500,
      positions: [pool()],
    });

    await usePositionsStore
      .getState()
      .fetchPositions({ publicKey: "GA", network: NETWORKS.PUBLIC });

    const state = usePositionsStore.getState();
    expect(state.positions).toEqual([pool()]);
    expect(state.hasLoaded).toBe(true);
    expect(state.error).toBeNull();
  });

  it("never lets a slow, older read replace a newer one", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mockGetBlendPositions
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { fetchPositions } = usePositionsStore.getState();
    const older = fetchPositions({ publicKey: "GA", network: NETWORKS.PUBLIC });
    const newer = fetchPositions({ publicKey: "GA", network: NETWORKS.PUBLIC });

    second.resolve({ totalValueUsd: 600, positions: [pool("6000000000")] });
    await newer;
    first.resolve({ totalValueUsd: 500, positions: [pool("5000000000")] });
    await older;

    expect(
      usePositionsStore.getState().positions[0].supply?.[0].totalTokens,
    ).toBe("6000000000");
  });

  it("drops another account's positions as soon as the account changes", async () => {
    mockGetBlendPositions.mockResolvedValueOnce({
      totalValueUsd: 500,
      positions: [pool()],
    });
    await usePositionsStore
      .getState()
      .fetchPositions({ publicKey: "GA", network: NETWORKS.PUBLIC });

    const pending = deferred<unknown>();
    mockGetBlendPositions.mockReturnValueOnce(pending.promise);
    const read = usePositionsStore
      .getState()
      .fetchPositions({ publicKey: "GB", network: NETWORKS.PUBLIC });

    expect(usePositionsStore.getState().positions).toEqual([]);
    expect(usePositionsStore.getState().hasLoaded).toBe(false);

    pending.resolve({ totalValueUsd: null, positions: [] });
    await read;
  });

  it("keeps the last good positions when a refresh fails", async () => {
    mockGetBlendPositions.mockResolvedValueOnce({
      totalValueUsd: 500,
      positions: [pool()],
    });
    await usePositionsStore
      .getState()
      .fetchPositions({ publicKey: "GA", network: NETWORKS.PUBLIC });

    mockGetBlendPositions.mockRejectedValueOnce(new Error("down"));
    await usePositionsStore
      .getState()
      .fetchPositions({ publicKey: "GA", network: NETWORKS.PUBLIC });

    const state = usePositionsStore.getState();
    expect(state.positions).toEqual([pool()]);
    expect(state.error).toBeNull();
  });

  it("reports a failed first read, and clears it once a read succeeds", async () => {
    mockGetBlendPositions.mockRejectedValueOnce(new Error("down"));
    await usePositionsStore
      .getState()
      .fetchPositions({ publicKey: "GA", network: NETWORKS.PUBLIC });
    expect(usePositionsStore.getState().error).not.toBeNull();

    mockGetBlendPositions.mockResolvedValueOnce({
      totalValueUsd: null,
      positions: [],
    });
    await usePositionsStore
      .getState()
      .fetchPositions({ publicKey: "GA", network: NETWORKS.PUBLIC });
    expect(usePositionsStore.getState().error).toBeNull();
    expect(usePositionsStore.getState().hasLoaded).toBe(true);
  });
});

describe("hasDepositLanded", () => {
  const awaited = {
    publicKey: "GA",
    network: NETWORKS.PUBLIC,
    poolId: POOL_ID,
    assetId: USDC_SAC,
    // In display units: what the deposit should bring the row to.
    minTokens: "750",
    expiresAt: Date.now() + 30_000,
  };

  it("holds once the deposited token reaches the awaited amount", () => {
    expect(
      hasDepositLanded([pool("7500000000")], awaited, networkDetails),
    ).toBe(true);
  });

  it("waits while the row is below it, or missing", () => {
    expect(
      hasDepositLanded([pool("5000000000")], awaited, networkDetails),
    ).toBe(false);
    expect(hasDepositLanded([], awaited, networkDetails)).toBe(false);
  });
});
