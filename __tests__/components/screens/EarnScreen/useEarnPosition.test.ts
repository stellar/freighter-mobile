/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook, waitFor } from "@testing-library/react-native";
import { useEarnPosition } from "components/screens/EarnScreen/hooks/useEarnPosition";
import { NETWORKS } from "config/constants";
import { useEarnStore } from "ducks/earn";

const mockGetBlendSuppliedTokens = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("services/blend", () => ({
  getBlendSuppliedTokens: (...args: unknown[]) =>
    mockGetBlendSuppliedTokens(...args),
}));

jest.mock("config/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

const baseParams = {
  poolId: "CPOOL",
  assetId: "CASSET",
  publicKey: "GSENDER",
  networkDetails: { network: NETWORKS.TESTNET } as never,
};

describe("useEarnPosition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEarnStore.getState().resetEarn();
  });

  it("writes the fetched position to the earn duck on success", async () => {
    mockGetBlendSuppliedTokens.mockResolvedValue("5000000000");

    const { result } = renderHook(() => useEarnPosition(baseParams));

    await waitFor(() => {
      expect(result.current.currentPositionTokens).toBe("5000000000");
    });

    expect(mockGetBlendSuppliedTokens).toHaveBeenCalledWith({
      publicKey: baseParams.publicKey,
      poolId: baseParams.poolId,
      assetId: baseParams.assetId,
      networkDetails: baseParams.networkDetails,
    });
  });

  // Load-bearing regression test: a rejected fetch (network error, backend
  // outage, unknown address) must be swallowed, not surfaced as a blocker.
  // Review renders the "after" value alone off whatever `currentPositionTokens`
  // already is — which must stay at its "0" default here, not be corrupted by
  // the failed attempt.
  it("is non-fatal on a rejected fetch: leaves currentPositionTokens at its default and logs instead of throwing", async () => {
    mockGetBlendSuppliedTokens.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useEarnPosition(baseParams));

    await waitFor(() => {
      expect(mockLoggerError).toHaveBeenCalledWith(
        "useEarnPosition",
        "Failed to fetch Blend position",
        expect.any(Error),
      );
    });

    expect(result.current.currentPositionTokens).toBe("0");
  });

  it("does not fetch until poolId, assetId, and publicKey are all known", () => {
    renderHook(() =>
      useEarnPosition({
        poolId: "",
        assetId: baseParams.assetId,
        publicKey: baseParams.publicKey,
        networkDetails: baseParams.networkDetails,
      }),
    );

    expect(mockGetBlendSuppliedTokens).not.toHaveBeenCalled();
  });

  it("re-fetches when the asset changes", async () => {
    mockGetBlendSuppliedTokens.mockResolvedValue("1000000000");

    const { rerender } = renderHook(
      (props: typeof baseParams) => useEarnPosition(props),
      { initialProps: baseParams },
    );

    await waitFor(() => {
      expect(mockGetBlendSuppliedTokens).toHaveBeenCalledTimes(1);
    });

    mockGetBlendSuppliedTokens.mockResolvedValue("2000000000");
    rerender({ ...baseParams, assetId: "CASSET_OTHER" });

    await waitFor(() => {
      expect(mockGetBlendSuppliedTokens).toHaveBeenCalledTimes(2);
    });

    expect(mockGetBlendSuppliedTokens).toHaveBeenLastCalledWith(
      expect.objectContaining({ assetId: "CASSET_OTHER" }),
    );
  });
});
