import { act, renderHook } from "@testing-library/react-hooks";
import { useNetworkStore } from "ducks/networkInfo";

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
        isConnected: false,
        isInternetReachable: false,
      });
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInternetReachable).toBe(false);
  });

  it("should handle null values in setNetworkInfo", () => {
    const { result } = renderHook(() => useNetworkStore());

    act(() => {
      result.current.setNetworkInfo({
        isConnected: null,
        isInternetReachable: null,
      });
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInternetReachable).toBe(false);
  });
});
