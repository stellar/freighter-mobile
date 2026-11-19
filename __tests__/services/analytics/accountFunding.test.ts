import { BigNumber } from "bignumber.js";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import {
  getFundedState,
  reportActiveAccountBalances,
  reportListAccountBalances,
} from "services/analytics/accountFunding";
import {
  canSendAnalytics,
  syncIdentifyTraits,
  track,
} from "services/analytics/core";
import {
  getFundedAccountCount,
  resetFundingRecordsCacheForTests,
} from "services/analytics/fundingRecords";
import { dataStorage } from "services/storage/storageFactory";

// In-memory AsyncStorage, so the tests can read the records back.
const mockStorage = new Map<string, string>();

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn((key: string) =>
      Promise.resolve(mockStorage.get(key) ?? null),
    ),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

jest.mock("services/analytics/core", () => ({
  canSendAnalytics: jest.fn(() => true),
  getAccountIdHash: jest.fn((publicKey: string) => `hash-${publicKey}`),
  syncIdentifyTraits: jest.fn(),
  track: jest.fn(),
}));

let mockAuthState: {
  account: { publicKey: string } | null;
  network: NETWORKS;
  allAccounts: { publicKey: string }[];
};

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: { getState: jest.fn(() => mockAuthState) },
}));

const PK_A = "GAAAA";
const PK_B = "GBBBB";
const USDC_ID = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const SPAM_ID = "SPAM:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const mockTrack = track as jest.Mock;
const mockCanSend = canSendAnalytics as jest.Mock;
const mockSyncIdentifyTraits = syncIdentifyTraits as jest.Mock;

const recordOf = (publicKey: string, network = NETWORKS.PUBLIC) => {
  const raw = mockStorage.get(
    `accountFundingRecord_${network}:hash-${publicKey}`,
  );
  return raw ? JSON.parse(raw) : null;
};

const nativeBalance = (total: string, price?: string) => ({
  token: { type: "native", code: "XLM" },
  total: new BigNumber(total),
  currentPrice: price ? new BigNumber(price) : undefined,
  fiatTotal: price ? new BigNumber(total).multipliedBy(price) : undefined,
});

const usdcBalance = (total: string, price?: string) => ({
  token: {
    type: "credit_alphanum4",
    code: "USDC",
    issuer: { key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
  },
  total: new BigNumber(total),
  currentPrice: price ? new BigNumber(price) : undefined,
  fiatTotal: price ? new BigNumber(total).multipliedBy(price) : undefined,
});

/** A funded result: 10 XLM at $0.1. */
const FUNDED = { native: nativeBalance("10", "0.1") };
/** An unfunded result: the account exists and holds 0 XLM. */
const EMPTY = { native: nativeBalance("0", "0.1") };

const reportActive = (
  pricedBalances: Record<string, unknown>,
  overrides: Partial<Parameters<typeof reportActiveAccountBalances>[0]> = {},
) =>
  reportActiveAccountBalances({
    publicKey: PK_A,
    network: NETWORKS.PUBLIC,
    isFunded: true,
    pricedBalances: pricedBalances as never,
    hiddenTokenIds: [],
    pricesOk: true,
    ...overrides,
  });

const reportList = (
  publicKey: string,
  totalUsd: string,
  overrides: Partial<Parameters<typeof reportListAccountBalances>[0]> = {},
) =>
  reportListAccountBalances({
    publicKey,
    network: NETWORKS.PUBLIC,
    balances: {} as never,
    isFunded: true,
    prices: {},
    pricesOk: true,
    totalUsd: new BigNumber(totalUsd),
    ...overrides,
  });

const fundedEvents = () =>
  mockTrack.mock.calls.filter(
    ([event]) => event === AnalyticsEvent.ACCOUNT_FUNDED,
  );

describe("getFundedState", () => {
  const base = {
    isFunded: true,
    hasBalanceError: false,
    hasPriceError: false,
    hasUnpricedXlm: false,
    totalUsd: new BigNumber(1),
  };

  it("is unfunded without a ledger entry, also when prices failed", () => {
    expect(
      getFundedState({ ...base, isFunded: false, hasPriceError: true }),
    ).toBe(false);
  });

  it("has no definite result when the balance fetch failed or isFunded is missing (VT-4)", () => {
    expect(getFundedState({ ...base, hasBalanceError: true })).toBeNull();
    expect(getFundedState({ ...base, isFunded: null })).toBeNull();
    expect(getFundedState({ ...base, isFunded: undefined })).toBeNull();
  });

  it("has no definite result when the price fetch failed (VT-5)", () => {
    expect(getFundedState({ ...base, hasPriceError: true })).toBeNull();
  });

  it("has no definite result when XLM has no price (VT-6)", () => {
    expect(getFundedState({ ...base, hasUnpricedXlm: true })).toBeNull();
  });

  it("uses the USD value, not isFunded (VT-7)", () => {
    expect(getFundedState({ ...base, totalUsd: new BigNumber(0) })).toBe(false);
    expect(getFundedState(base)).toBe(true);
  });
});

describe("account.funded detection (active-account fetch)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    resetFundingRecordsCacheForTests();
    mockCanSend.mockReturnValue(true);
    mockAuthState = {
      account: { publicKey: PK_A },
      network: NETWORKS.PUBLIC,
      allAccounts: [{ publicKey: PK_A }, { publicKey: PK_B }],
    };
  });

  it("emits one event for an unfunded result, then a funded result (VT-1)", async () => {
    await reportActive(EMPTY);
    expect(recordOf(PK_A)).toEqual({ funded: false, status: "unfunded" });
    expect(fundedEvents()).toHaveLength(0);

    await reportActive(FUNDED);
    expect(fundedEvents()).toHaveLength(1);
    expect(recordOf(PK_A)).toEqual({ funded: true, status: "funded" });
  });

  it("treats an account with no ledger entry as unfunded", async () => {
    await reportActive({}, { isFunded: false, pricesOk: false });
    expect(recordOf(PK_A)).toEqual({ funded: false, status: "unfunded" });
  });

  it("does not emit for a funded result on first sight (VT-2)", async () => {
    await reportActive(FUNDED);
    expect(fundedEvents()).toHaveLength(0);
    expect(recordOf(PK_A)).toEqual({ funded: true, status: "funded" });
  });

  it("does not emit again for repeated funded results (VT-3)", async () => {
    await reportActive(EMPTY);
    await reportActive(FUNDED);
    await reportActive(FUNDED);
    await reportActive(FUNDED);
    expect(fundedEvents()).toHaveLength(1);
  });

  it.each([
    ["isFunded is missing (VT-4)", FUNDED, { isFunded: undefined }],
    ["the price fetch failed (VT-5)", FUNDED, { pricesOk: false }],
    [
      "XLM above zero has no price (VT-6)",
      { native: nativeBalance("10"), [USDC_ID]: usdcBalance("5", "1") },
      {},
    ],
  ])("changes no record when %s", async (_name, balances, overrides) => {
    await reportActive(EMPTY);
    const before = recordOf(PK_A);

    await reportActive(balances, overrides);

    expect(recordOf(PK_A)).toEqual(before);
    expect(fundedEvents()).toHaveLength(0);
  });

  it("is unfunded when every priced balance is zero (VT-7)", async () => {
    await reportActive({
      native: nativeBalance("0", "0.1"),
      [USDC_ID]: usdcBalance("0", "1"),
    });
    expect(recordOf(PK_A)?.funded).toBe(false);
  });

  it("is funded with zero XLM and a priced USDC balance (VT-8)", async () => {
    await reportActive({
      native: nativeBalance("0", "0.1"),
      [USDC_ID]: usdcBalance("5", "1"),
    });
    expect(recordOf(PK_A)?.funded).toBe(true);
  });

  it("is unfunded when only an unpriced token is above zero (VT-9)", async () => {
    await reportActive({
      native: nativeBalance("0", "0.1"),
      [USDC_ID]: usdcBalance("5"),
    });
    expect(recordOf(PK_A)?.funded).toBe(false);
  });

  it("is unfunded when a hidden priced token is the only value (VT-10)", async () => {
    await reportActive(
      { native: nativeBalance("0", "0.1"), [SPAM_ID]: usdcBalance("5", "1") },
      { hiddenTokenIds: [SPAM_ID] },
    );
    expect(recordOf(PK_A)?.funded).toBe(false);
  });

  it("ignores testnet data (VT-11, VT-28)", async () => {
    mockAuthState.network = NETWORKS.TESTNET;
    await reportActive(EMPTY, { network: NETWORKS.TESTNET });
    await reportActive(FUNDED, { network: NETWORKS.TESTNET });

    expect(mockStorage.size).toBe(0);
    expect(fundedEvents()).toHaveLength(0);
    expect(mockSyncIdentifyTraits).not.toHaveBeenCalled();
  });

  it("ignores data for an account that is not active (VT-12)", async () => {
    await reportActive(EMPTY, { publicKey: PK_B });
    await reportActive(FUNDED, { publicKey: PK_B });

    expect(recordOf(PK_B)).toBeNull();
    expect(fundedEvents()).toHaveLength(0);
  });

  it("does not emit when the account switches while the record is locked (VT-13)", async () => {
    await reportActive(EMPTY);

    // Hold the lock: the next record read waits until the test releases it.
    let releaseRead: () => void = () => undefined;
    (dataStorage.getItem as jest.Mock).mockImplementationOnce(
      (key: string) =>
        new Promise((resolve) => {
          releaseRead = () => resolve(mockStorage.get(key) ?? null);
        }),
    );

    const first = reportActive(EMPTY);
    const second = reportActive(FUNDED);
    await Promise.resolve();

    // The user selects another account before the second update runs.
    mockAuthState.account = { publicKey: PK_B };
    releaseRead();
    await Promise.all([first, second]);

    expect(fundedEvents()).toHaveLength(0);
    expect(recordOf(PK_A)?.status).toBe("unfunded");
  });

  it("sets pending when consent drops the event, then emits after opt-in (VT-15)", async () => {
    await reportActive(EMPTY);

    mockCanSend.mockReturnValue(false);
    await reportActive(FUNDED);
    expect(fundedEvents()).toHaveLength(0);
    expect(recordOf(PK_A)?.status).toBe("pending");

    mockCanSend.mockReturnValue(true);
    await reportActive(FUNDED);
    expect(fundedEvents()).toHaveLength(1);
    expect(recordOf(PK_A)?.status).toBe("funded");
  });

  it("emits one event for two parallel updates (VT-16)", async () => {
    await reportActive(EMPTY);
    await Promise.all([reportActive(FUNDED), reportActive(FUNDED)]);
    expect(fundedEvents()).toHaveLength(1);
  });

  it("emits again after funded, unfunded, funded (VT-18)", async () => {
    await reportActive(EMPTY);
    await reportActive(FUNDED);
    await reportActive(EMPTY);
    await reportActive(FUNDED);
    expect(fundedEvents()).toHaveLength(2);
  });
});

describe("funded_account_count", () => {
  const hashes = (...keys: string[]) => keys.map((key) => `hash-${key}`);

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    resetFundingRecordsCacheForTests();
    mockCanSend.mockReturnValue(true);
    mockAuthState = {
      account: { publicKey: PK_A },
      network: NETWORKS.PUBLIC,
      allAccounts: [{ publicKey: PK_A }, { publicKey: PK_B }],
    };
  });

  it("counts an imported account that is funded on first sight, without an event (VT-21)", async () => {
    await reportActive(FUNDED);

    expect(fundedEvents()).toHaveLength(0);
    expect(mockSyncIdentifyTraits).toHaveBeenCalledWith(
      mockAuthState.allAccounts,
    );
    expect(getFundedAccountCount(hashes(PK_A))).toBe(1);
  });

  it("returns null while a record is not loaded, so no partial count is sent", async () => {
    await reportActive(FUNDED);
    expect(getFundedAccountCount(hashes(PK_A, PK_B))).toBeNull();
  });

  it("sets only `funded` for an all-accounts result (VT-22)", async () => {
    await reportList(PK_B, "5");

    expect(recordOf(PK_B)).toEqual({ funded: true });
    expect(fundedEvents()).toHaveLength(0);
    expect(mockSyncIdentifyTraits).toHaveBeenCalledTimes(1);
  });

  it("does not emit when the account is funded on its first active result after an all-accounts result (VT-23)", async () => {
    await reportList(PK_A, "0");
    await reportActive(FUNDED);

    expect(fundedEvents()).toHaveLength(0);
    expect(recordOf(PK_A)).toEqual({ funded: true, status: "funded" });
  });

  it("does not consume a pending transition", async () => {
    await reportActive(EMPTY);
    await reportList(PK_A, "5");
    expect(recordOf(PK_A)).toEqual({ funded: true, status: "unfunded" });

    await reportActive(FUNDED);
    expect(fundedEvents()).toHaveLength(1);
  });

  it("goes down when an account becomes unfunded or is removed (VT-24)", async () => {
    await reportActive(FUNDED);
    await reportList(PK_B, "5");
    expect(getFundedAccountCount(hashes(PK_A, PK_B))).toBe(2);

    await reportList(PK_B, "0");
    expect(getFundedAccountCount(hashes(PK_A, PK_B))).toBe(1);

    // The user removes account A: the count includes only allAccounts.
    expect(getFundedAccountCount(hashes(PK_B))).toBe(0);
  });

  it("does not sync again when an all-accounts result changes nothing", async () => {
    await reportList(PK_B, "5");
    await reportList(PK_B, "5");
    expect(mockSyncIdentifyTraits).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["the fetch for the account failed", { balances: null }],
    ["the price fetch for the batch failed", { pricesOk: false }],
    ["isFunded is missing", { isFunded: undefined }],
  ])("changes no record when %s (VT-27)", async (_name, overrides) => {
    await reportList(PK_B, "5", overrides);
    expect(recordOf(PK_B)).toBeNull();
  });

  it("has no definite result when the all-accounts XLM balance has no price", async () => {
    await reportList(PK_B, "0", {
      balances: { native: nativeBalance("10") } as never,
      prices: {},
    });
    expect(recordOf(PK_B)).toBeNull();

    await reportList(PK_B, "1", {
      balances: { native: nativeBalance("10") } as never,
      prices: { XLM: { currentPrice: new BigNumber("0.1") } } as never,
    });
    expect(recordOf(PK_B)).toEqual({ funded: true });
  });

  it("ignores testnet results and accounts that are not own accounts (VT-28)", async () => {
    await reportList(PK_B, "5", { network: NETWORKS.TESTNET });
    await reportList("GNOTOWN", "5");
    expect(mockStorage.size).toBe(0);
  });
});
