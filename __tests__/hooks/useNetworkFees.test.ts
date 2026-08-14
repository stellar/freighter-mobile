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
      feePresets: {
        low: "0.001",
        medium: "0.003",
        high: "0.005",
      },
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
      feePresets: {
        low: "0.001",
        medium: "0.003",
        high: "0.005",
      },
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
      feePresets: {
        low: "0.001",
        medium: "0.003",
        high: "0.005",
      },
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

  it("a fetch settling after a flow exit doesn't evict the next flow's fetch", async () => {
    // Flow A leaves while its fetch is still pending, then flow B starts its
    // own before A's settles. A's cleanup must not drop B's entry, or a later
    // consumer starts a third fetch whose response can overwrite the snapshot
    // B's consumers are already showing.
    let resolveFirst: (value: unknown) => void = () => {};
    mockGetNetworkFees.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const flowA = renderHook(() => useNetworkFees());
    expect(mockGetNetworkFees).toHaveBeenCalledTimes(1);

    // Flow A exits mid-fetch.
    flowA.unmount();
    act(() => {
      clearNetworkFeesCache();
    });

    // Flow B starts its own fetch, still pending.
    let resolveSecond: (value: unknown) => void = () => {};
    mockGetNetworkFees.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSecond = resolve;
      }),
    );
    const flowBPrewarm = renderHook(() => useNetworkFees());
    expect(mockGetNetworkFees).toHaveBeenCalledTimes(2);

    // A's fetch settles now — it must leave B's in-flight entry alone.
    await act(async () => {
      resolveFirst({
        recommendedFee: "0.005",
        networkCongestion: NetworkCongestion.HIGH,
        feePresets: { low: "0.001", medium: "0.003", high: "0.005" },
      });
      await Promise.resolve();
    });

    // A second consumer in flow B joins B's fetch instead of starting a third.
    const flowBScreen = renderHook(() => useNetworkFees());
    expect(mockGetNetworkFees).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveSecond({
        recommendedFee: "0.009",
        networkCongestion: NetworkCongestion.MEDIUM,
        feePresets: { low: "0.002", medium: "0.009", high: "0.02" },
      });
      await Promise.resolve();
    });

    // Both consumers show the same snapshot — B's.
    expect(flowBPrewarm.result.current.recommendedFee).toBe("0.009");
    expect(flowBScreen.result.current.recommendedFee).toBe("0.009");

    flowBPrewarm.unmount();
    flowBScreen.unmount();
  });
});
