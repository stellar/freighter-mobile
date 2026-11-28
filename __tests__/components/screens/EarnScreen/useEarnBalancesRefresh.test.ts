import { renderHook } from "@testing-library/react-native";
import { useEarnBalancesRefresh } from "components/screens/EarnScreen/hooks/useEarnBalancesRefresh";
import { BALANCES_FETCH_POLLING_INTERVAL, NETWORKS } from "config/constants";

const mockFetchAccountBalances = jest.fn();
jest.mock("ducks/balances", () => ({
  useBalancesStore: () => ({ fetchAccountBalances: mockFetchAccountBalances }),
}));

// Focus is driven by hand: `mockFocus()` runs the screen's focus effect and
// keeps its cleanup, `mockBlur()` runs that cleanup.
let mockFocusEffect: (() => void | (() => void)) | null = null;
let mockFocusCleanup: (() => void) | void;
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockFocusEffect = effect;
  },
}));
const mockFocus = () => {
  mockFocusCleanup = mockFocusEffect?.();
};
const mockBlur = () => {
  mockFocusCleanup?.();
  mockFocusCleanup = undefined;
};

const PUBLIC_KEY = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

describe("useEarnBalancesRefresh", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] });
    mockFetchAccountBalances.mockClear();
    mockFocusEffect = null;
    mockFocusCleanup = undefined;
  });

  afterEach(() => {
    mockBlur();
    jest.useRealTimers();
  });

  it("refreshes the balances every time the screen gains focus", () => {
    renderHook(() =>
      useEarnBalancesRefresh({
        publicKey: PUBLIC_KEY,
        network: NETWORKS.TESTNET,
      }),
    );

    mockFocus();
    expect(mockFetchAccountBalances).toHaveBeenCalledTimes(1);
    expect(mockFetchAccountBalances).toHaveBeenCalledWith({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.TESTNET,
    });

    mockBlur();
    mockFocus();
    expect(mockFetchAccountBalances).toHaveBeenCalledTimes(2);
  });

  it("keeps refreshing while focused, and stops once it loses focus", () => {
    renderHook(() =>
      useEarnBalancesRefresh({
        publicKey: PUBLIC_KEY,
        network: NETWORKS.TESTNET,
      }),
    );

    mockFocus();
    jest.advanceTimersByTime(BALANCES_FETCH_POLLING_INTERVAL);
    expect(mockFetchAccountBalances).toHaveBeenCalledTimes(2);

    mockBlur();
    jest.advanceTimersByTime(BALANCES_FETCH_POLLING_INTERVAL * 3);
    expect(mockFetchAccountBalances).toHaveBeenCalledTimes(2);
  });

  it("returns a refresh the caller can run on its own, e.g. after a swap", () => {
    const { result } = renderHook(() =>
      useEarnBalancesRefresh({
        publicKey: PUBLIC_KEY,
        network: NETWORKS.PUBLIC,
      }),
    );

    result.current();

    expect(mockFetchAccountBalances).toHaveBeenCalledWith({
      publicKey: PUBLIC_KEY,
      network: NETWORKS.PUBLIC,
    });
  });

  it("does nothing without an account", () => {
    const { result } = renderHook(() =>
      useEarnBalancesRefresh({ publicKey: "", network: NETWORKS.TESTNET }),
    );

    mockFocus();
    result.current();

    expect(mockFetchAccountBalances).not.toHaveBeenCalled();
  });
});
