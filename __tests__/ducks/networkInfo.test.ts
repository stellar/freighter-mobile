import { NetInfoStateType } from "@react-native-community/netinfo";
import { act, renderHook } from "@testing-library/react-hooks";
import { useNetworkStore } from "ducks/networkInfo";

jest.mock("@react-native-community/netinfo", () => ({
  NetInfoStateType: {
    none: "none",
    unknown: "unknown",
  },
}));

describe("networkInfo store", () => {
  beforeEach(() => {
    // Reset the store before each test
    act(() => {
      useNetworkStore.setState({
        isConnected: true,
        isInternetReachable: true,
      });
    });
  });

  it("should have initial state", () => {
    const { result } = renderHook(() => useNetworkStore());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isInternetReachable).toBe(true);
  });

  it("should handle setNetworkInfo", () => {
    const { result } = renderHook(() => useNetworkStore());

    act(() => {
      result.current.setNetworkInfo({
        type: NetInfoStateType.none,
        isConnected: false,
        isInternetReachable: false,
        details: null,
      });
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInternetReachable).toBe(false);
  });

  it("should handle unknown network state", () => {
    const { result } = renderHook(() => useNetworkStore());

    act(() => {
      result.current.setNetworkInfo({
        type: NetInfoStateType.unknown,
        isConnected: null,
        isInternetReachable: null,
        details: null,
      });
    });

    expect(result.current.isConnected).toBe(null);
    expect(result.current.isInternetReachable).toBe(null);
  });
});
