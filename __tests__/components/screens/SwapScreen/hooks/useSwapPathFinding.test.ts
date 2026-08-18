/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook } from "@testing-library/react-hooks";
import { useSwapPathFinding } from "components/screens/SwapScreen/hooks/useSwapPathFinding";
import { DEFAULT_DEBOUNCE_DELAY, NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";

const mockFindSwapPath = jest.fn();
const mockClearPath = jest.fn();

jest.mock("ducks/swap", () => ({
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
  swapSlippage: 2,
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

const flush = () => jest.advanceTimersByTime(DEFAULT_DEBOUNCE_DELAY);

describe("useSwapPathFinding", () => {
  it("runs path-finding once on mount", () => {
    renderHook((props) => useSwapPathFinding(props), {
      initialProps: baseProps(),
    });
    flush();

    expect(mockFindSwapPath).toHaveBeenCalledTimes(1);
  });

  it("does NOT re-run when sourceBalance is a NEW object with the SAME id (balance poll)", () => {
    const { rerender } = renderHook((props) => useSwapPathFinding(props), {
      initialProps: baseProps(),
    });
    flush();
    expect(mockFindSwapPath).toHaveBeenCalledTimes(1);

    // Simulate the 30s balance poll: brand-new object refs, identical ids.
    rerender({
      ...baseProps(),
      sourceBalance: makeBalance("USDC:GA5..."),
      destinationTokenForPath: makeBalance("AQUA:GBNZ..."),
    });
    flush();

    expect(mockFindSwapPath).toHaveBeenCalledTimes(1);
  });

  it("DOES re-run when sourceAmount changes", () => {
    const { rerender } = renderHook((props) => useSwapPathFinding(props), {
      initialProps: baseProps(),
    });
    flush();
    expect(mockFindSwapPath).toHaveBeenCalledTimes(1);

    rerender({ ...baseProps(), sourceAmount: "20" });
    flush();

    expect(mockFindSwapPath).toHaveBeenCalledTimes(2);
  });

  it("DOES re-run when the source token id changes", () => {
    const { rerender } = renderHook((props) => useSwapPathFinding(props), {
      initialProps: baseProps(),
    });
    flush();
    expect(mockFindSwapPath).toHaveBeenCalledTimes(1);

    rerender({ ...baseProps(), sourceBalance: makeBalance("XLM:native") });
    flush();

    expect(mockFindSwapPath).toHaveBeenCalledTimes(2);
  });

  it("DOES re-run when the destination token id changes", () => {
    const { rerender } = renderHook((props) => useSwapPathFinding(props), {
      initialProps: baseProps(),
    });
    flush();
    expect(mockFindSwapPath).toHaveBeenCalledTimes(1);

    rerender({
      ...baseProps(),
      destinationTokenForPath: makeBalance("yXLM:GBNZ..."),
    });
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
      }),
    );
  });
});
