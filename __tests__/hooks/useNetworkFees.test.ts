import { renderHook, act } from "@testing-library/react-hooks";
import { NetworkCongestion } from "config/types";
import { useNetworkFees } from "hooks/useNetworkFees";

const mockGetNetworkFees = jest.fn();

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "TESTNET" }),
}));

jest.mock("services/stellar", () => ({
  getNetworkFees: () => mockGetNetworkFees(),
  stellarSdkServer: jest.fn(() => ({})),
}));

describe("useNetworkFees", () => {
  beforeEach(() => {
    mockGetNetworkFees.mockReset();
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

    // Flush the fetch promise + its setState.
    await act(async () => {
      await Promise.resolve();
    });
    expect(first.result.current.networkCongestion).toBe(NetworkCongestion.HIGH);
    expect(first.result.current.recommendedFee).toBe("0.005");
    first.unmount();

    // Second mount: a hanging fetch so only the seeded initial state is read.
    // It already shows the cached real values — no "Low" / empty flash.
    mockGetNetworkFees.mockReturnValue(new Promise(() => {}));
    const second = renderHook(() => useNetworkFees());
    expect(second.result.current.networkCongestion).toBe(
      NetworkCongestion.HIGH,
    );
    expect(second.result.current.recommendedFee).toBe("0.005");
    second.unmount();
  });
});
