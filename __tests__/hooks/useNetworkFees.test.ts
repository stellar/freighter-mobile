import { renderHook, act } from "@testing-library/react-hooks";
import { NetworkCongestion } from "config/types";
import { clearNetworkFeesCache, useNetworkFees } from "hooks/useNetworkFees";

const mockGetNetworkFees = jest.fn();

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "TESTNET" }),
}));

jest.mock("services/stellar", () => ({
  getNetworkFees: () => mockGetNetworkFees(),
  stellarSdkServer: jest.fn(() => ({})),
}));

const flushPromises = () =>
  act(async () => {
    await Promise.resolve();
  });

describe("useNetworkFees", () => {
  beforeEach(() => {
    mockGetNetworkFees.mockReset();
    // Reset the frozen snapshot so tests don't leak state into each other.
    clearNetworkFeesCache();
  });

  it("seeds a subsequent mount from the last successful fetch (no default flash)", async () => {
    mockGetNetworkFees.mockResolvedValue({
      recommendedFee: "0.005",
      networkCongestion: NetworkCongestion.HIGH,
    });

    // First mount: starts at the defaults, then fills in from the fetch.
    const first = renderHook(() => useNetworkFees());
    expect(first.result.current.networkCongestion).toBe(NetworkCongestion.LOW);
    expect(first.result.current.recommendedFee).toBe("");

    await flushPromises();
    expect(first.result.current.networkCongestion).toBe(NetworkCongestion.HIGH);
    expect(first.result.current.recommendedFee).toBe("0.005");
    first.unmount();

    // Second mount reads the cached real values immediately — no flash.
    const second = renderHook(() => useNetworkFees());
    expect(second.result.current.networkCongestion).toBe(
      NetworkCongestion.HIGH,
    );
    expect(second.result.current.recommendedFee).toBe("0.005");
    second.unmount();
  });

  it("freezes after the first fetch — later mounts reuse the snapshot without refetching", async () => {
    mockGetNetworkFees.mockResolvedValue({
      recommendedFee: "0.005",
      networkCongestion: NetworkCongestion.HIGH,
    });

    const first = renderHook(() => useNetworkFees());
    await flushPromises();
    first.unmount();
    expect(mockGetNetworkFees).toHaveBeenCalledTimes(1);

    // A later mount within the same flow reuses the cache — no extra fetch.
    const second = renderHook(() => useNetworkFees());
    await flushPromises();
    second.unmount();
    expect(mockGetNetworkFees).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after clearNetworkFeesCache (next flow gets fresh values)", async () => {
    mockGetNetworkFees.mockResolvedValue({
      recommendedFee: "0.005",
      networkCongestion: NetworkCongestion.HIGH,
    });

    const first = renderHook(() => useNetworkFees());
    await flushPromises();
    first.unmount();
    expect(mockGetNetworkFees).toHaveBeenCalledTimes(1);

    // Leaving the flow clears the snapshot, so the next entry fetches again.
    act(() => {
      clearNetworkFeesCache();
    });
    const second = renderHook(() => useNetworkFees());
    await flushPromises();
    second.unmount();
    expect(mockGetNetworkFees).toHaveBeenCalledTimes(2);
  });
});
