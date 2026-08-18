import { renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { useSyncAccountsFiatTotals } from "hooks/useSyncAccountsFiatTotals";

const PK_OLD = "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
const PK_NEW = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const mockPricedBalances = {
  XLM: { fiatTotal: new BigNumber("50") },
};

// Mutable balances-store state, read lazily at render time so each test can
// shape the snapshot the hook sees.
let mockBalancesState: Record<string, unknown> = {};

jest.mock("ducks/balances", () => ({
  useBalancesStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockBalancesState),
}));

const mockSyncAccountFiatTotal = jest.fn();

jest.mock("ducks/accountsFiatTotals", () => ({
  useAccountsFiatTotalsStore: (
    selector: (state: Record<string, unknown>) => unknown,
  ) => selector({ syncAccountFiatTotal: mockSyncAccountFiatTotal }),
}));

describe("useSyncAccountsFiatTotals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBalancesState = {
      pricedBalances: mockPricedBalances,
      fetchedPublicKey: PK_OLD,
      fetchedNetwork: NETWORKS.PUBLIC,
      isLoading: false,
      // Funded state and the fetch error travel with the snapshot: the store
      // needs both to pick between "$0.00" and "--" for the active row.
      isFunded: true,
      error: null,
    };
  });

  it("syncs when the balances snapshot matches the active account", () => {
    renderHook(() =>
      useSyncAccountsFiatTotals({
        publicKey: PK_OLD,
        network: NETWORKS.PUBLIC,
      }),
    );

    expect(mockSyncAccountFiatTotal).toHaveBeenCalledWith({
      publicKey: PK_OLD,
      network: NETWORKS.PUBLIC,
      pricedBalances: mockPricedBalances,
      isFunded: true,
      hasError: false,
    });
  });

  it("skips the sync while the snapshot still belongs to the previous account", () => {
    // Account switched to PK_NEW but the balances store still holds PK_OLD's
    // snapshot — syncing would write the old total under the new key.
    renderHook(() =>
      useSyncAccountsFiatTotals({
        publicKey: PK_NEW,
        network: NETWORKS.PUBLIC,
      }),
    );

    expect(mockSyncAccountFiatTotal).not.toHaveBeenCalled();
  });

  // Regression: a failed fetch is never stamped, so the guard used to drop the
  // error and leave the row on "$0.00" while the Home header showed "--".
  it("syncs a failed fetch even though it was never stamped", () => {
    mockBalancesState = {
      ...mockBalancesState,
      fetchedPublicKey: null,
      fetchedNetwork: null,
      error: "Failed to fetch balances",
    };

    renderHook(() =>
      useSyncAccountsFiatTotals({
        publicKey: PK_OLD,
        network: NETWORKS.PUBLIC,
      }),
    );

    expect(mockSyncAccountFiatTotal).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: PK_OLD, hasError: true }),
    );
  });

  // The error is only worth writing once the request has actually settled.
  it("still waits for an in-flight fetch before syncing an error", () => {
    mockBalancesState = {
      ...mockBalancesState,
      fetchedPublicKey: null,
      fetchedNetwork: null,
      error: "Failed to fetch balances",
      isLoading: true,
    };

    renderHook(() =>
      useSyncAccountsFiatTotals({
        publicKey: PK_OLD,
        network: NETWORKS.PUBLIC,
      }),
    );

    expect(mockSyncAccountFiatTotal).not.toHaveBeenCalled();
  });

  it("skips the sync while a balances fetch is in flight", () => {
    // Mid-fetch, the account stamp is already updated (written with the raw
    // balances) but pricedBalances hasn't caught up yet.
    mockBalancesState = {
      ...mockBalancesState,
      fetchedPublicKey: PK_NEW,
      isLoading: true,
    };

    renderHook(() =>
      useSyncAccountsFiatTotals({
        publicKey: PK_NEW,
        network: NETWORKS.PUBLIC,
      }),
    );

    expect(mockSyncAccountFiatTotal).not.toHaveBeenCalled();
  });

  it("skips the sync when the snapshot belongs to another network", () => {
    renderHook(() =>
      useSyncAccountsFiatTotals({
        publicKey: PK_OLD,
        network: NETWORKS.TESTNET,
      }),
    );

    expect(mockSyncAccountFiatTotal).not.toHaveBeenCalled();
  });

  it("skips the sync without a public key", () => {
    mockBalancesState = { ...mockBalancesState, fetchedPublicKey: "" };

    renderHook(() =>
      useSyncAccountsFiatTotals({ publicKey: "", network: NETWORKS.PUBLIC }),
    );

    expect(mockSyncAccountFiatTotal).not.toHaveBeenCalled();
  });
});
