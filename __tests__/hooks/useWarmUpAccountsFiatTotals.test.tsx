import { renderHook } from "@testing-library/react-hooks";
import { NETWORKS } from "config/constants";
import { useWarmUpAccountsFiatTotals } from "hooks/useWarmUpAccountsFiatTotals";
import { AppState, AppStateStatus } from "react-native";

const PK_1 = "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
const PK_2 = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const mockFetchAccountsFiatTotals = jest.fn();
let mockNetwork = NETWORKS.PUBLIC;
let mockIsLoadingBalances = false;

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: (selector: (state: unknown) => unknown) =>
    selector({
      network: mockNetwork,
      allAccounts: [{ publicKey: PK_1 }, { publicKey: PK_2 }],
    }),
}));

jest.mock("ducks/balances", () => ({
  useBalancesStore: (selector: (state: unknown) => unknown) =>
    selector({ isLoading: mockIsLoadingBalances }),
}));

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: (selector: (state: unknown) => unknown) =>
    selector({ isLoading: false }),
}));

jest.mock("ducks/accountsFiatTotals", () => ({
  useAccountsFiatTotalsStore: (selector: (state: unknown) => unknown) =>
    selector({ fetchAccountsFiatTotals: mockFetchAccountsFiatTotals }),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: { publicKey: PK_1 } }),
}));

describe("useWarmUpAccountsFiatTotals", () => {
  let appStateListener: (state: AppStateStatus) => void;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork = NETWORKS.PUBLIC;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        appStateListener = listener as (state: AppStateStatus) => void;
        return { remove } as never;
      });
  });

  // The warm-up waits for one balances cycle on the network to start and end.
  const renderWarmedUp = () => {
    mockIsLoadingBalances = true;
    const hook = renderHook(() => useWarmUpAccountsFiatTotals());
    mockIsLoadingBalances = false;
    hook.rerender();
    return hook;
  };

  const expectedCall = {
    publicKeys: [PK_1, PK_2],
    network: NETWORKS.PUBLIC,
    excludePublicKey: PK_1,
  };

  it("warms up after the first balances cycle, then again on each return to the foreground", () => {
    renderWarmedUp();
    expect(mockFetchAccountsFiatTotals).toHaveBeenCalledTimes(1);
    expect(mockFetchAccountsFiatTotals).toHaveBeenLastCalledWith(expectedCall);

    appStateListener("background");
    appStateListener("active");

    // No forceRefresh: the store's 3-minute freshness check decides if the
    // cycle runs (FR-30).
    expect(mockFetchAccountsFiatTotals).toHaveBeenCalledTimes(2);
    expect(mockFetchAccountsFiatTotals).toHaveBeenLastCalledWith(expectedCall);
  });

  it("does not refresh on the foreground on testnet (VT-33)", () => {
    mockNetwork = NETWORKS.TESTNET;
    renderWarmedUp();
    mockFetchAccountsFiatTotals.mockClear();

    appStateListener("background");
    appStateListener("active");

    expect(mockFetchAccountsFiatTotals).not.toHaveBeenCalled();
  });

  it("does not refresh on the foreground before the first warm-up", () => {
    renderHook(() => useWarmUpAccountsFiatTotals());

    appStateListener("background");
    appStateListener("active");

    expect(mockFetchAccountsFiatTotals).not.toHaveBeenCalled();
  });

  it("removes the AppState listener on unmount", () => {
    const { unmount } = renderWarmedUp();
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
