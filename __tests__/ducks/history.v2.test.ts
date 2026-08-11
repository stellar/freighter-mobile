import { Asset } from "@stellar/stellar-sdk";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { HistoryDataV2, useHistoryStore } from "ducks/history";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { HistoryEntry } from "helpers/history/v2/model";
import { getNativeContractDetails } from "helpers/soroban";
import { getAccountHistoryV2, IS_HISTORY_V2_MOCKED } from "services/backend";

const PUBLIC_KEY = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const OTHER_PUBLIC_KEY =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF7";

// Mutable so the "switch to an unfunded account" test can flip it mid-test;
// reset to true in beforeEach so it doesn't leak into the other tests, which
// all assume a funded account.
let mockIsFunded = true;

jest.mock("ducks/balances", () => ({
  useBalancesStore: {
    // getState() is invoked fresh on every call inside the duck, so reading
    // mockIsFunded here (rather than capturing it once) lets a single test
    // flip funded -> unfunded mid-sequence.
    getState: () => ({
      fetchAccountBalances: jest.fn().mockResolvedValue(undefined),
      getBalances: () => ({}),
      isFunded: mockIsFunded,
    }),
  },
}));

// Wraps the real getAccountHistoryV2 (which serves the mock fixture) so a
// single test can force it to reject without disturbing the other tests,
// which rely on the fixture data actually being mapped.
jest.mock("services/backend", () => {
  const actual = jest.requireActual("services/backend");
  return {
    ...actual,
    getAccountHistoryV2: jest.fn(actual.getAccountHistoryV2),
  };
});

describe("useHistoryStore — v2 branch", () => {
  beforeEach(() => {
    mockIsFunded = true;
    useHistoryStore.setState({
      rawHistoryData: null,
      rawHistoryV2Data: null,
      loadedHistoryAccount: null,
      isLoading: false,
      error: null,
      isFetching: false,
      hasRecentTransaction: false,
    });
  });

  it("populates rawHistoryV2Data when the flag is on", async () => {
    useRemoteConfigStore.setState({ use_history_v2: true });

    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });

    const { rawHistoryV2Data, rawHistoryData, error } =
      useHistoryStore.getState();
    expect(error).toBeNull();
    expect(rawHistoryData).toBeNull();
    expect(rawHistoryV2Data?.entries.length).toBeGreaterThan(0);
    // mapped model, not raw wire shape
    expect(rawHistoryV2Data?.entries[0]).toHaveProperty("primaryText");
    expect(rawHistoryV2Data?.entries[0]).toHaveProperty("rowIcon");
  });

  it("uses the v1 path when the flag is off", async () => {
    useRemoteConfigStore.setState({ use_history_v2: false });

    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });

    expect(useHistoryStore.getState().rawHistoryV2Data).toBeNull();
  });

  it("falls back to v1 on a network v2 does not serve", async () => {
    useRemoteConfigStore.setState({ use_history_v2: true });

    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.FUTURENET,
    });

    // No throw, no error state — the v1 path served it.
    expect(useHistoryStore.getState().error).toBeNull();
    expect(useHistoryStore.getState().rawHistoryV2Data).toBeNull();
  });

  it("builds v2 sections grouped by month", async () => {
    useRemoteConfigStore.setState({ use_history_v2: true });

    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });

    const data = useHistoryStore.getState().getFilteredHistoryData({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      isHideDustEnabled: false,
    });

    expect(data?.history.length).toBeGreaterThan(0);
    expect(data?.history[0]).toHaveProperty("monthYear");
    expect(data?.history[0]).toHaveProperty("entries");
  });

  it("sets the error state when getAccountHistoryV2 throws", async () => {
    useRemoteConfigStore.setState({ use_history_v2: true });
    (getAccountHistoryV2 as jest.Mock).mockRejectedValueOnce(
      new Error("v2 backend unavailable"),
    );

    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });

    const { error, rawHistoryV2Data, isFetching, isLoading } =
      useHistoryStore.getState();
    // The whole point of getAccountHistoryV2 throwing (rather than returning
    // an empty page) is that the duck's existing catch turns it into a
    // user-visible error instead of a silently empty history.
    expect(error).toBe("v2 backend unavailable");
    expect(rawHistoryV2Data).toBeNull();
    expect(isFetching).toBe(false);
    expect(isLoading).toBe(false);
  });

  it("does not leak the previous account's v2 history onto an unfunded account", async () => {
    useRemoteConfigStore.setState({ use_history_v2: true });

    // Account A: funded, v2 populates rawHistoryV2Data with real entries.
    mockIsFunded = true;
    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });
    expect(
      useHistoryStore.getState().rawHistoryV2Data?.entries.length,
    ).toBeGreaterThan(0);

    // Switch to account B, which is unfunded. The short-circuit must not
    // leave account A's entries behind in rawHistoryV2Data — otherwise
    // getFilteredHistoryData (which checks rawHistoryV2Data first) would
    // render account A's transaction history under account B.
    mockIsFunded = false;
    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: OTHER_PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });

    expect(useHistoryStore.getState().rawHistoryV2Data).toBeNull();

    const data = useHistoryStore.getState().getFilteredHistoryData({
      publicKey: OTHER_PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      isHideDustEnabled: false,
    });
    // Account B's (v1, empty) shape, not account A's populated v2 sections.
    expect(data?.history).toEqual([]);
  });

  it("does not leak account A's v2 history when switching to account B and the v2 fetch then throws", async () => {
    useRemoteConfigStore.setState({ use_history_v2: true });

    // Account A: funded, v2 populates rawHistoryV2Data with real entries.
    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });
    expect(
      useHistoryStore.getState().rawHistoryV2Data?.entries.length,
    ).toBeGreaterThan(0);

    // Switch to account B. fetchAccountBalances succeeds for B (mockIsFunded
    // stays true), so the unfunded short-circuit does NOT fire — this is the
    // route the round-1 fix doesn't cover. getAccountHistoryV2 then throws
    // before any set() for B runs, landing in the catch, which deliberately
    // never touches rawHistoryV2Data/loadedHistoryAccount.
    (getAccountHistoryV2 as jest.Mock).mockRejectedValueOnce(
      new Error("v2 backend unavailable"),
    );
    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: OTHER_PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });
    expect(useHistoryStore.getState().error).toBe("v2 backend unavailable");

    // rawHistoryV2Data still physically holds account A's entries (the catch
    // doesn't clear it) — the identity guard in getFilteredHistoryData is
    // what must refuse to serve them under account B's identity.
    const dataForB = useHistoryStore.getState().getFilteredHistoryData({
      publicKey: OTHER_PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      isHideDustEnabled: false,
    });
    expect(dataForB).toBeNull();
  });

  it("still returns account A's stale history on a same-account failed refresh", async () => {
    useRemoteConfigStore.setState({ use_history_v2: true });

    // Initial successful fetch for account A.
    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });
    const initialEntries = useHistoryStore.getState().rawHistoryV2Data?.entries;
    expect(initialEntries?.length).toBeGreaterThan(0);

    // A background refresh for the SAME account fails.
    (getAccountHistoryV2 as jest.Mock).mockRejectedValueOnce(
      new Error("transient network blip"),
    );
    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      isBackgroundRefresh: true,
    });
    expect(useHistoryStore.getState().error).toBe("transient network blip");

    // The identity matches (still account A), so the stale-but-correct data
    // must still be served — this is the v1-parity behavior the brief wanted
    // and that the identity guard must not regress.
    const data = useHistoryStore.getState().getFilteredHistoryData({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      isHideDustEnabled: false,
    });
    expect(data?.history.length).toBeGreaterThan(0);
    expect(useHistoryStore.getState().rawHistoryV2Data?.entries).toEqual(
      initialEntries,
    );
  });

  it("does not serve the previous network's history for the same account after a network switch", async () => {
    useRemoteConfigStore.setState({ use_history_v2: true });

    // Fetch on mainnet for the account: populates rawHistoryV2Data and
    // records loadedHistoryAccount = { publicKey: PUBLIC_KEY, network: PUBLIC }.
    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });
    const mainnetEntries = useHistoryStore.getState().rawHistoryV2Data?.entries;
    expect(mainnetEntries?.length).toBeGreaterThan(0);

    // Switch networks for the SAME public key, and this fetch throws before
    // any set() for testnet runs (mirrors a real network-switch failure —
    // e.g. the user flips network and the request is interrupted). The catch
    // deliberately leaves rawHistoryV2Data holding mainnet's entries.
    (getAccountHistoryV2 as jest.Mock).mockRejectedValueOnce(
      new Error("testnet fetch failed"),
    );
    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.TESTNET,
    });
    expect(useHistoryStore.getState().error).toBe("testnet fetch failed");

    // Same public key, but testnet was never actually loaded — the stale
    // mainnet entries must not be served under the testnet identity.
    const dataForTestnet = useHistoryStore.getState().getFilteredHistoryData({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.TESTNET,
      isHideDustEnabled: false,
    });
    expect(dataForTestnet).toBeNull();

    // Asking for the same public key back on mainnet (its correct, loaded
    // network) must still work — the guard isn't blocking the account
    // outright, only the mismatched network.
    const dataForMainnet = useHistoryStore.getState().getFilteredHistoryData({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      isHideDustEnabled: false,
    });
    expect(dataForMainnet?.history.length).toBeGreaterThan(0);
  });
});

// FIX 1: params.tokenId (TokenDetailsScreen's route param) is a balances-map
// key — "XLM" for native, "CODE:ISSUER" for classic assets, produced by
// getTokenIdentifier in helpers/balances.ts — never a bare contract id. This
// mirrors v1's filterOperationsByToken (which normalizes via
// getTokenFromTokenId first) by resolving params.tokenId to a contract id
// before calling filterHistoryEntriesByToken, which matches on
// row.token.contractId. The existing filters.test.ts suite only ever passed
// bare contract ids, which is exactly what hid this bug.
describe("useHistoryStore — v2 tokenId resolution (FIX 1)", () => {
  const entryWithToken = (id: string, contractId: string): HistoryEntry =>
    ({
      id,
      kind: "sent",
      createdAt: "2024-04-08T14:33:00Z",
      rowIcon: { type: "contract" },
      primaryText: "",
      secondaryText: "",
      secondaryIcon: null,
      amounts: null,
      details: {
        title: "",
        status: "success",
        fee: "0.00001",
        rate: null,
        contractId: null,
        functionName: null,
        protocol: null,
        counterparty: null,
        balanceChanges: [
          {
            token: {
              code: "X",
              contractId,
              issuer: null,
              icon: null,
              decimals: 7,
            },
            amount: "5",
            direction: "debit" as const,
          },
        ],
        stateChangeCards: [],
        operations: [],
      },
    }) as HistoryEntry;

  const nativeContractId = getNativeContractDetails(NETWORKS.PUBLIC).contract;
  const otherContractId =
    "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

  const idsIn = (data: HistoryDataV2) =>
    data.history.flatMap((section) => section.entries.map((e) => e.id));

  beforeEach(() => {
    useHistoryStore.setState({
      rawHistoryData: null,
      rawHistoryV2Data: null,
      loadedHistoryAccount: { publicKey: PUBLIC_KEY, network: NETWORKS.PUBLIC },
      isLoading: false,
      error: null,
      isFetching: false,
      hasRecentTransaction: false,
    });
  });

  it('filters by "XLM" — the real balances-map key for native, not a contract id — matching the native SAC entry', () => {
    useHistoryStore.setState({
      rawHistoryV2Data: {
        balances: {},
        entries: [
          entryWithToken("native-tx", nativeContractId),
          entryWithToken("other-tx", otherContractId),
        ],
      },
    });

    const data = useHistoryStore.getState().getFilteredHistoryData({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      tokenId: "XLM",
      isHideDustEnabled: false,
    }) as HistoryDataV2;

    expect(idsIn(data)).toEqual(["native-tx"]);
  });

  it("filters by a CODE:ISSUER balances-map key, deriving the SAC contract id the same way tokenResolver.ts's indexBalancesByContractId does", () => {
    const code = "USDC";
    const issuer = "GDMTVHLWJTHSUDMZVVMXXH6VJHA2ZV3HNG5LYNAZ6RTWB7GISM6PGTUV";
    const { networkPassphrase } = mapNetworkToNetworkDetails(NETWORKS.PUBLIC);
    const expectedContractId = new Asset(code, issuer).contractId(
      networkPassphrase,
    );

    useHistoryStore.setState({
      rawHistoryV2Data: {
        balances: {},
        entries: [
          entryWithToken("usdc-tx", expectedContractId),
          entryWithToken("native-tx", nativeContractId),
        ],
      },
    });

    const data = useHistoryStore.getState().getFilteredHistoryData({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      tokenId: `${code}:${issuer}`,
      isHideDustEnabled: false,
    }) as HistoryDataV2;

    expect(idsIn(data)).toEqual(["usdc-tx"]);
  });

  it("returns every entry (no filter) rather than a wrong filter when the tokenId cannot be resolved to a contract id", () => {
    useHistoryStore.setState({
      rawHistoryV2Data: {
        balances: {},
        entries: [
          entryWithToken("native-tx", nativeContractId),
          entryWithToken("other-tx", otherContractId),
        ],
      },
    });

    const data = useHistoryStore.getState().getFilteredHistoryData({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
      // No colon, not "native"/"XLM", not a contract id: getTokenFromTokenId
      // returns { code: "unresolvable-token-id", issuer: undefined }, which
      // resolveTokenIdToContractId cannot turn into a contract id.
      tokenId: "unresolvable-token-id",
      isHideDustEnabled: false,
    }) as HistoryDataV2;

    expect(idsIn(data)).toEqual(["native-tx", "other-tx"]);
  });
});

// FIX 2: use_history_v2 is a BOOLEAN_FLAGS entry, so fetchFeatureFlags can
// overwrite its production default from Amplitude on any released build,
// with no app release. IS_HISTORY_V2_MOCKED only changes with a release, so
// nothing coupled the two — an operator flipping the Amplitude experiment
// alone would make every pubnet/testnet account render
// mockFetchAccountHistoryV2's fabricated fixture list as its own history.
// The interlock in ducks/history.ts only allows v2 while mocked when
// isDev/__DEV__ signal a non-released build (so the fixtures stay usable
// for local development).
// `__DEV__` is declared globally as `const __DEV__: boolean` (see
// @types/react-native), so `global.__DEV__` is not a recognized property of
// `typeof globalThis` to tsc even though it's how the jest/RN runtime
// actually sets it. This narrow cast is the only way to override it for a
// single test.
const globalWithDev = global as typeof globalThis & { __DEV__: boolean };

describe("useHistoryStore — v2 mock interlock (FIX 2)", () => {
  // eslint-disable-next-line no-underscore-dangle -- __DEV__ is the React Native global, not an internal/private convention name.
  const originalDev = globalWithDev.__DEV__;

  beforeEach(() => {
    (getAccountHistoryV2 as jest.Mock).mockClear();
  });

  afterEach(() => {
    // eslint-disable-next-line no-underscore-dangle -- see the declaration above.
    globalWithDev.__DEV__ = originalDev;
  });

  it("does not activate v2 from the remote flag alone while the endpoint is mocked, in a production-like environment", async () => {
    // isDev (helpers/isEnv) reads getBundleId(), which the react-native-device-info
    // jest mock returns as "unknown" — so isDev is already false under Jest.
    // Forcing __DEV__ false as well simulates a released build, where the
    // interlock is the only thing standing between the remote flag and
    // fixture data reaching a real user.
    // eslint-disable-next-line no-underscore-dangle -- see the declaration above.
    globalWithDev.__DEV__ = false;
    useRemoteConfigStore.setState({ use_history_v2: true });

    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });

    // IS_HISTORY_V2_MOCKED is true (fixtures) at this point in the rollout —
    // asserted here so this test fails loudly, instead of silently passing
    // for the wrong reason, on the day it flips to false.
    expect(IS_HISTORY_V2_MOCKED).toBe(true);
    expect(getAccountHistoryV2).not.toHaveBeenCalled();
    expect(useHistoryStore.getState().rawHistoryV2Data).toBeNull();
  });

  it("still activates v2 in a dev build even while the endpoint is mocked (fixtures stay usable for local work)", async () => {
    // eslint-disable-next-line no-underscore-dangle -- see the declaration above.
    globalWithDev.__DEV__ = true;
    useRemoteConfigStore.setState({ use_history_v2: true });

    await useHistoryStore.getState().fetchAccountHistory({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });

    expect(getAccountHistoryV2).toHaveBeenCalled();
    expect(
      useHistoryStore.getState().rawHistoryV2Data?.entries.length,
    ).toBeGreaterThan(0);
  });
});
