/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook } from "@testing-library/react-hooks";
import { useSwapPathFinding } from "components/screens/SwapScreen/hooks/useSwapPathFinding";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { SwapInputSide } from "ducks/swap";

const mockFindSwapPath = jest.fn();
const mockClearPath = jest.fn();

jest.mock("ducks/swap", () => ({
  ...jest.requireActual("ducks/swap"),
  useSwapStore: () => ({
    findSwapPath: mockFindSwapPath,
    clearPath: mockClearPath,
  }),
}));

type HookProps = Parameters<typeof useSwapPathFinding>[0];

const makeBalance = (id: string) =>
  ({
    id,
    tokenCode: id.split(":")[0],
    tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  }) as never;

const baseProps = (): HookProps => ({
  sourceBalance: makeBalance("USDC:GA5..."),
  destinationTokenForPath: makeBalance("AQUA:GBNZ..."),
  sourceAmount: "10",
  inputSide: SwapInputSide.SOURCE,
  destinationInputAmount: "0",
  swapSlippage: 2,
  swapTimeout: 180,
  network: NETWORKS.PUBLIC,
  publicKey: "GTEST...",
  amountError: null,
});

beforeEach(() => {
  jest.useFakeTimers();
  mockFindSwapPath.mockClear();
  mockClearPath.mockClear();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const flush = () => jest.advanceTimersByTime(200);

describe("useSwapPathFinding", () => {
  const mountAndFlush = () => {
    const view = renderHook((props) => useSwapPathFinding(props), {
      initialProps: baseProps(),
    });
    flush();

    return view;
  };

  it("runs path-finding once on mount", () => {
    mountAndFlush();

    expect(mockFindSwapPath).toHaveBeenCalledTimes(1);
  });

  it("acknowledges a valid amount immediately and quotes 200ms after the last edit", () => {
    const { rerender } = renderHook((props) => useSwapPathFinding(props), {
      initialProps: baseProps(),
    });
    expect(mockClearPath).toHaveBeenLastCalledWith(true);
    jest.advanceTimersByTime(150);
    rerender({ ...baseProps(), sourceAmount: "20" });
    expect(mockClearPath).toHaveBeenLastCalledWith(true);
    jest.advanceTimersByTime(199);
    expect(mockFindSwapPath).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(mockFindSwapPath).toHaveBeenCalledTimes(1);
    expect(mockFindSwapPath).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceAmount: "20" }),
    );
  });

  it.each([
    ["zero amount", { sourceAmount: "0" }],
    ["invalid amount", { amountError: "invalid" }],
    ["missing destination", { destinationTokenForPath: undefined }],
  ])("cancels the pending quote and loading for %s", (_name, change) => {
    const { rerender } = renderHook((props) => useSwapPathFinding(props), {
      initialProps: baseProps(),
    });
    jest.advanceTimersByTime(100);
    rerender({ ...baseProps(), ...change });
    expect(mockClearPath).toHaveBeenLastCalledWith(false);
    flush();
    expect(mockFindSwapPath).not.toHaveBeenCalled();
  });

  it("invalidates the active quote on unmount and cancels the debounce", () => {
    const { unmount } = renderHook((props) => useSwapPathFinding(props), {
      initialProps: baseProps(),
    });
    mockClearPath.mockClear();
    unmount();
    expect(mockClearPath).toHaveBeenCalledTimes(1);
    expect(mockClearPath).toHaveBeenCalledWith();
    flush();
    expect(mockFindSwapPath).not.toHaveBeenCalled();
  });

  it("does NOT re-run when sourceBalance is a NEW object with the SAME id (balance poll)", () => {
    const { rerender } = mountAndFlush();

    // Simulate the 30s balance poll: brand-new object refs, identical ids.
    rerender({
      ...baseProps(),
      sourceBalance: makeBalance("USDC:GA5..."),
      destinationTokenForPath: makeBalance("AQUA:GBNZ..."),
    });
    flush();

    expect(mockFindSwapPath).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["sourceAmount", { sourceAmount: "20" }],
    ["swap timeout", { swapTimeout: 60 }],
    ["the source token id", { sourceBalance: makeBalance("XLM:native") }],
    [
      "the destination token id",
      { destinationTokenForPath: makeBalance("yXLM:GBNZ...") },
    ],
  ])("DOES re-run when %s changes", (_what, change) => {
    const { rerender } = mountAndFlush();

    rerender({ ...baseProps(), ...change });
    expect(mockClearPath).toHaveBeenCalledTimes(2);
    flush();

    expect(mockFindSwapPath).toHaveBeenCalledTimes(2);
  });

  it("reads the latest objects at call time even when keyed on id", () => {
    const first = baseProps();
    const { rerender } = renderHook((props) => useSwapPathFinding(props), {
      initialProps: first,
    });

    // Re-render with a new sourceBalance object (same id) BEFORE the debounce
    // fires, then change the amount so the effect re-runs. The call must use
    // the latest object reference, proving the ref-based debounce closure.
    const latestSource = makeBalance("USDC:GA5...");
    rerender({ ...first, sourceBalance: latestSource, sourceAmount: "30" });
    flush();

    expect(mockFindSwapPath).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourceBalance: latestSource,
        sourceAmount: "30",
        slippage: 2,
        timeoutSeconds: 180,
      }),
    );
  });

  describe("when the user typed the amount to receive", () => {
    const exactOutProps = (): HookProps => ({
      ...baseProps(),
      sourceAmount: "0",
      inputSide: SwapInputSide.DESTINATION,
      destinationInputAmount: "2.3",
    });

    const mount = (props = exactOutProps()) =>
      renderHook((p) => useSwapPathFinding(p), { initialProps: props });

    it("asks for the typed receive amount, not a source amount", () => {
      mount();
      flush();

      expect(mockFindSwapPath).toHaveBeenCalledTimes(1);
      const params = mockFindSwapPath.mock.calls[0][0];
      expect(params.destinationAmount).toBe("2.3");
      expect(params).not.toHaveProperty("sourceAmount");
    });

    it("does NOT re-run when the amount to sell, which the quote derives, changes", () => {
      const { rerender } = mount();
      flush();

      rerender({ ...exactOutProps(), sourceAmount: "10.0489927" });
      flush();

      expect(mockFindSwapPath).toHaveBeenCalledTimes(1);
    });

    it("DOES re-run when the typed receive amount changes", () => {
      const { rerender } = mount();
      flush();

      rerender({ ...exactOutProps(), destinationInputAmount: "2.4" });
      flush();

      expect(mockFindSwapPath).toHaveBeenCalledTimes(2);
      expect(mockFindSwapPath.mock.calls[1][0].destinationAmount).toBe("2.4");
    });

    it("clears the path when the typed receive amount is zero", () => {
      mount({ ...exactOutProps(), destinationInputAmount: "0" });
      flush();

      expect(mockFindSwapPath).not.toHaveBeenCalled();
      expect(mockClearPath).toHaveBeenCalled();
    });

    it("re-runs when the user switches back to typing the amount to sell", () => {
      const { rerender } = mount();
      flush();

      rerender({ ...baseProps(), sourceAmount: "10" });
      flush();

      expect(mockFindSwapPath).toHaveBeenCalledTimes(2);
      expect(mockFindSwapPath.mock.calls[1][0].sourceAmount).toBe("10");
    });
  });
});
