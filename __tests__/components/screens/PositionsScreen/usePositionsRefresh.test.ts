import { act, renderHook } from "@testing-library/react-native";
import {
  POOL_ID,
  USDC_SAC,
  poolPosition,
  supplyRow,
} from "__tests__/support/positionFixtures";
import {
  POSITIONS_REFRESH_MS,
  useAwaitedDepositFollow,
  usePositionsRefresh,
} from "components/screens/PositionsScreen/hooks/usePositionsRefresh";
import { BlendPoolPosition } from "config/blendTypes";
import { NETWORKS } from "config/constants";
import { positionsKeyFor, usePositionsStore } from "ducks/positions";

// Focus is the caller screen's; here it's always focused.
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (effect: () => void | (() => void)) =>
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    require("react").useEffect(effect, [effect]),
}));

const mockGetBlendPositions = jest.fn();
const mockGetBlendPools = jest.fn();
const mockGetBlendEarnOptions = jest.fn();
jest.mock("services/blend", () => ({
  getBlendPositions: (...args: unknown[]) => mockGetBlendPositions(...args),
  getBlendPools: (...args: unknown[]) => mockGetBlendPools(...args),
  getBlendEarnOptions: (...args: unknown[]) => mockGetBlendEarnOptions(...args),
}));

const PUBLIC_KEY = "GACCOUNT";
const params = {
  publicKey: PUBLIC_KEY,
  network: NETWORKS.PUBLIC,
  isAvailable: true,
};

/** Positions with `tokens` USDC supplied, in whole units. */
const positionsWith = (tokens: number): BlendPoolPosition[] => [
  poolPosition({
    supply: [supplyRow({ totalTokens: String(tokens * 1e7) })],
  }),
];

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

/** Advances fake time, then lets the reads it started settle. */
const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

describe("usePositionsRefresh", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    usePositionsStore.getState().reset();
    mockGetBlendPositions.mockResolvedValue({
      totalValueUsd: 0,
      positions: positionsWith(500),
    });
    mockGetBlendPools.mockResolvedValue([]);
    mockGetBlendEarnOptions.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reads at once for an account it hasn't read, then every 30 seconds", async () => {
    renderHook(() => usePositionsRefresh(params));
    await advance(0);
    expect(mockGetBlendPositions).toHaveBeenCalledTimes(1);

    await advance(POSITIONS_REFRESH_MS);
    expect(mockGetBlendPositions).toHaveBeenCalledTimes(2);
  });

  it("waits out the interval after a recent read, as on coming back to a screen", async () => {
    usePositionsStore.setState({
      fetchedKey: positionsKeyFor(PUBLIC_KEY, NETWORKS.PUBLIC),
      lastReadStartedAt: Date.now() - 10_000,
    });

    renderHook(() => usePositionsRefresh(params));
    await advance(19_000);
    expect(mockGetBlendPositions).not.toHaveBeenCalled();

    await advance(1_000);
    expect(mockGetBlendPositions).toHaveBeenCalledTimes(1);
  });

  it("never waits longer than the interval, even when the clock went back", async () => {
    usePositionsStore.setState({
      fetchedKey: positionsKeyFor(PUBLIC_KEY, NETWORKS.PUBLIC),
      // A read stamped an hour ahead of the device's clock.
      lastReadStartedAt: Date.now() + 60 * 60 * 1000,
    });

    renderHook(() => usePositionsRefresh(params));
    await advance(POSITIONS_REFRESH_MS);

    expect(mockGetBlendPositions).toHaveBeenCalledTimes(1);
  });

  it("reads nothing while Positions are unavailable", async () => {
    renderHook(() => usePositionsRefresh({ ...params, isAvailable: false }));
    await advance(POSITIONS_REFRESH_MS * 2);

    expect(mockGetBlendPositions).not.toHaveBeenCalled();
    expect(mockGetBlendPools).not.toHaveBeenCalled();
  });

  it("reads the pool catalog once per network", async () => {
    const { rerender } = renderHook(() => usePositionsRefresh(params));
    await flush();
    rerender({});
    await flush();

    expect(mockGetBlendPools).toHaveBeenCalledTimes(1);
  });

  it("reads no earn catalog while there are positions", async () => {
    renderHook(() => usePositionsRefresh(params));
    await advance(0);
    await flush();

    expect(mockGetBlendEarnOptions).not.toHaveBeenCalled();
  });

  it("reads the earn catalog once positions land empty, once for every screen refreshing", async () => {
    mockGetBlendPositions.mockResolvedValue({
      totalValueUsd: 0,
      positions: [],
    });
    // Home, and a pool screen over it.
    renderHook(() => usePositionsRefresh(params));
    renderHook(() => usePositionsRefresh(params));
    await advance(0);
    await flush();

    expect(mockGetBlendEarnOptions).toHaveBeenCalledTimes(1);
    expect(mockGetBlendPools).toHaveBeenCalledTimes(1);
  });
});

describe("useAwaitedDepositFollow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    usePositionsStore.getState().reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const awaitDeposit = (overrides = {}) =>
    usePositionsStore.getState().setAwaitedDeposit({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      poolId: POOL_ID,
      assetId: USDC_SAC,
      // 500 held, 10 deposited: done at 505.
      minTokens: "505",
      expiresAt: Date.now() + 30_000,
      ...overrides,
    });

  it("re-reads every 3 seconds until the deposit shows, then stops waiting", async () => {
    mockGetBlendPositions
      .mockResolvedValueOnce({
        totalValueUsd: 0,
        positions: positionsWith(500),
      })
      .mockResolvedValueOnce({
        totalValueUsd: 0,
        positions: positionsWith(510),
      });
    awaitDeposit();

    renderHook(() => useAwaitedDepositFollow(params));
    await flush();
    expect(mockGetBlendPositions).toHaveBeenCalledTimes(1);
    expect(usePositionsStore.getState().awaitedDeposit).not.toBeNull();

    await advance(3_000);
    await flush();

    expect(mockGetBlendPositions).toHaveBeenCalledTimes(2);
    expect(usePositionsStore.getState().awaitedDeposit).toBeNull();
    expect(usePositionsStore.getState().positions).toEqual(positionsWith(510));

    await advance(30_000);
    expect(mockGetBlendPositions).toHaveBeenCalledTimes(2);
  });

  it("reads once more after the wait expired, then gives up", async () => {
    mockGetBlendPositions.mockResolvedValue({
      totalValueUsd: 0,
      positions: positionsWith(500),
    });
    awaitDeposit({ expiresAt: Date.now() - 1 });

    renderHook(() => useAwaitedDepositFollow(params));
    await flush();

    expect(mockGetBlendPositions).toHaveBeenCalledTimes(1);
    expect(usePositionsStore.getState().awaitedDeposit).toBeNull();
  });

  it("leaves another account's deposit alone", async () => {
    awaitDeposit({ publicKey: "GOTHER" });

    renderHook(() => useAwaitedDepositFollow(params));
    await flush();

    expect(mockGetBlendPositions).not.toHaveBeenCalled();
    expect(usePositionsStore.getState().awaitedDeposit).not.toBeNull();
  });
});
