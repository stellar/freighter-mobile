import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import {
  ClassicBalance,
  NativeBalance,
  TokenPricesMap,
  TokenTypeWithCustomToken,
} from "config/types";
import {
  ACCOUNTS_FIAT_TOTALS_BATCH_SIZE,
  ACCOUNTS_FIAT_TOTALS_TTL_MS,
  useAccountsFiatTotalsStore,
} from "ducks/accountsFiatTotals";
import { usePricesStore } from "ducks/prices";
import { fetchBalances } from "services/backend";

jest.mock("services/backend", () => ({
  fetchBalances: jest.fn(),
}));

jest.mock("ducks/prices", () => ({
  usePricesStore: {
    getState: jest.fn(),
  },
}));

jest.mock("ducks/remoteConfig", () => ({
  useRemoteConfigStore: {
    getState: jest.fn(() => ({ use_token_prices_v2: true })),
  },
}));

describe("accountsFiatTotals duck", () => {
  const mockFetchBalances = fetchBalances as jest.MockedFunction<
    typeof fetchBalances
  >;
  const mockGetPricesState = usePricesStore.getState as jest.MockedFunction<
    typeof usePricesStore.getState
  >;

  const PK_1 = "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const PK_2 = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  const USDC_ISSUER =
    "GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST5TVOM";

  const nativeBalance: NativeBalance = {
    token: { code: "XLM", type: "native" as const },
    total: new BigNumber("100"),
    available: new BigNumber("100"),
    minimumBalance: new BigNumber("1"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
  };

  const usdcBalance: ClassicBalance = {
    token: {
      code: "USDC",
      issuer: { key: USDC_ISSUER },
      type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    },
    total: new BigNumber("200"),
    available: new BigNumber("200"),
    limit: new BigNumber("1000"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
  };

  const mockBalanceMap = {
    XLM: nativeBalance,
    [`USDC:${USDC_ISSUER}`]: usdcBalance,
  };

  const mockPrices: TokenPricesMap = {
    XLM: {
      currentPrice: new BigNumber("0.5"),
      percentagePriceChange24h: new BigNumber("0.02"),
    },
    [`USDC:${USDC_ISSUER}`]: {
      currentPrice: new BigNumber("1"),
      percentagePriceChange24h: new BigNumber("-0.01"),
    },
  };

  const mockFetchPricesForTokenIds = jest.fn();

  const mockPricesState = (prices: TokenPricesMap = mockPrices) => {
    mockGetPricesState.mockReturnValue({
      fetchPricesForTokenIds: mockFetchPricesForTokenIds,
      pricesByNetwork: { [NETWORKS.PUBLIC]: prices },
    } as unknown as ReturnType<typeof usePricesStore.getState>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAccountsFiatTotalsStore.setState({
      fiatTotals: {},
      isLoading: false,
      lastUpdatedAt: null,
      lastNetwork: null,
    });
    mockFetchPricesForTokenIds.mockResolvedValue(undefined);
    mockPricesState();
    mockFetchBalances.mockResolvedValue({
      balances: mockBalanceMap,
      isFunded: true,
      subentryCount: 1,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("computes fiat totals for each account on mainnet", async () => {
    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1, PK_2],
      network: NETWORKS.PUBLIC,
    });

    const { fiatTotals, isLoading, lastUpdatedAt, lastNetwork } =
      useAccountsFiatTotalsStore.getState();

    // 100 XLM * $0.5 + 200 USDC * $1 = $250
    expect(fiatTotals[PK_1]?.toString()).toBe("250");
    expect(fiatTotals[PK_2]?.toString()).toBe("250");
    expect(isLoading).toBe(false);
    expect(lastUpdatedAt).not.toBeNull();
    expect(lastNetwork).toBe(NETWORKS.PUBLIC);
    expect(mockFetchBalances).toHaveBeenCalledWith({
      publicKey: PK_1,
      network: NETWORKS.PUBLIC,
      shouldSkipScan: true,
    });
  });

  it("counts unpriced tokens as zero", async () => {
    mockPricesState({
      XLM: {
        currentPrice: new BigNumber("0.5"),
        percentagePriceChange24h: null,
      },
    });

    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });

    // Only XLM priced: 100 * $0.5
    expect(
      useAccountsFiatTotalsStore.getState().fiatTotals[PK_1]?.toString(),
    ).toBe("50");
  });

  it("returns zero for unfunded accounts (empty balances)", async () => {
    mockFetchBalances.mockResolvedValue({
      balances: undefined,
      isFunded: false,
      subentryCount: 0,
    });

    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });

    expect(
      useAccountsFiatTotalsStore.getState().fiatTotals[PK_1]?.toString(),
    ).toBe("0");
  });

  it("isolates per-account fetch failures as null totals", async () => {
    mockFetchBalances.mockImplementation(({ publicKey }) =>
      publicKey === PK_2
        ? Promise.reject(new Error("network error"))
        : Promise.resolve({
            balances: mockBalanceMap,
            isFunded: true,
            subentryCount: 1,
          }),
    );

    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1, PK_2],
      network: NETWORKS.PUBLIC,
    });

    const { fiatTotals, isLoading } = useAccountsFiatTotalsStore.getState();
    expect(fiatTotals[PK_1]?.toString()).toBe("250");
    expect(fiatTotals[PK_2]).toBeNull();
    expect(isLoading).toBe(false);
  });

  it("does not fetch on non-mainnet networks and clears totals", async () => {
    useAccountsFiatTotalsStore.setState({
      fiatTotals: { [PK_1]: new BigNumber("250") },
      lastUpdatedAt: Date.now(),
      lastNetwork: NETWORKS.PUBLIC,
    });

    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.TESTNET,
    });

    expect(mockFetchBalances).not.toHaveBeenCalled();
    expect(useAccountsFiatTotalsStore.getState().fiatTotals).toEqual({});
  });

  it("skips refetch within the TTL when all accounts are cached", async () => {
    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });
    expect(mockFetchBalances).toHaveBeenCalledTimes(1);

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });
    expect(mockFetchBalances).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL expires", async () => {
    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });
    expect(mockFetchBalances).toHaveBeenCalledTimes(1);

    useAccountsFiatTotalsStore.setState({
      lastUpdatedAt: Date.now() - ACCOUNTS_FIAT_TOTALS_TTL_MS - 1,
    });

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });
    expect(mockFetchBalances).toHaveBeenCalledTimes(2);
  });

  it("refetches within the TTL when new accounts are missing from the cache", async () => {
    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });
    expect(mockFetchBalances).toHaveBeenCalledTimes(1);

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1, PK_2],
      network: NETWORKS.PUBLIC,
    });
    expect(mockFetchBalances).toHaveBeenCalledTimes(3);
  });

  it("bypasses the TTL with forceRefresh", async () => {
    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });
    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
      forceRefresh: true,
    });

    expect(mockFetchBalances).toHaveBeenCalledTimes(2);
  });

  it("fetches accounts in sequential batches with one price fetch per batch", async () => {
    const publicKeys = Array.from(
      { length: ACCOUNTS_FIAT_TOTALS_BATCH_SIZE + 1 },
      (_, i) => `${PK_1.slice(0, -2)}${String(i).padStart(2, "0")}`,
    );

    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys,
      network: NETWORKS.PUBLIC,
    });

    expect(mockFetchBalances).toHaveBeenCalledTimes(publicKeys.length);
    expect(mockFetchPricesForTokenIds).toHaveBeenCalledTimes(2);
    expect(mockFetchPricesForTokenIds).toHaveBeenCalledWith({
      tokens: ["XLM", `USDC:${USDC_ISSUER}`],
      network: NETWORKS.PUBLIC,
      useV2: true,
    });

    const { fiatTotals } = useAccountsFiatTotalsStore.getState();
    publicKeys.forEach((publicKey) => {
      expect(fiatTotals[publicKey]?.toString()).toBe("250");
    });
  });

  it("ignores concurrent calls while a fetch is in flight", async () => {
    let resolveBalances!: (value: {
      balances: typeof mockBalanceMap;
      isFunded: boolean;
      subentryCount: number;
    }) => void;
    mockFetchBalances.mockReturnValue(
      new Promise((resolve) => {
        resolveBalances = resolve;
      }),
    );

    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    const firstCall = fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });
    const secondCall = fetchAccountsFiatTotals({
      publicKeys: [PK_1, PK_2],
      network: NETWORKS.PUBLIC,
    });

    resolveBalances({
      balances: mockBalanceMap,
      isFunded: true,
      subentryCount: 1,
    });
    await Promise.all([firstCall, secondCall]);

    expect(mockFetchBalances).toHaveBeenCalledTimes(1);
  });

  it("clears totals from another network before fetching", async () => {
    useAccountsFiatTotalsStore.setState({
      fiatTotals: { STALE_KEY: new BigNumber("999") },
      lastUpdatedAt: Date.now(),
      lastNetwork: NETWORKS.TESTNET,
    });

    const { fetchAccountsFiatTotals } = useAccountsFiatTotalsStore.getState();

    await fetchAccountsFiatTotals({
      publicKeys: [PK_1],
      network: NETWORKS.PUBLIC,
    });

    const { fiatTotals } = useAccountsFiatTotalsStore.getState();
    expect(fiatTotals.STALE_KEY).toBeUndefined();
    expect(fiatTotals[PK_1]?.toString()).toBe("250");
  });
});
