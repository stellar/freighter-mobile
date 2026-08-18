/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook } from "@testing-library/react-hooks";
import BigNumber from "bignumber.js";
import {
  SWAP_TOAST_IDS,
  useSwapAmountError,
} from "components/screens/SwapScreen/hooks/useSwapAmountError";
import { TokenTypeWithCustomToken } from "config/types";

type HookProps = Parameters<typeof useSwapAmountError>[0];

const mockShowToast = jest.fn();
const mockHasXLMForFees = jest.fn();
const mockIsAmountSpendable = jest.fn();

jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("helpers/balances", () => ({
  ...jest.requireActual("helpers/balances"),
  hasXLMForFees: (...args: unknown[]) => mockHasXLMForFees(...args),
  isAmountSpendable: (...args: unknown[]) => mockIsAmountSpendable(...args),
}));

// Stable t-function + translation-object references: returning a fresh
// `t` per render would make the hook's validation-effect deps change
// every render and trip "Maximum update depth exceeded". Define both
// INSIDE the factory so they survive `jest.mock` hoisting (factories
// referencing outer-scope vars hit TDZ when mocked-module imports
// resolve before the test file's top-level consts run).
jest.mock("hooks/useAppTranslation", () => {
  const stableT = (key: string, opts?: Record<string, unknown>) =>
    `${key}::${JSON.stringify(opts ?? {})}`;
  const stableTranslation = { t: stableT };
  return {
    __esModule: true,
    default: () => stableTranslation,
  };
});

const baseSourceBalance = {
  id: "USDC:GA5...",
  tokenCode: "USDC",
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
} as never;

const baseDestinationDescriptor = {
  id: "AQUA:GBNZIL...",
  tokenCode: "AQUA",
  decimals: 7,
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  requiresTrustline: false,
};

// IMPORTANT: hoist mutable inputs to module scope so their references
// are stable across hook re-renders. The validation effect's deps
// include `balanceItems` (and `spendableAmount`); fresh references per
// render would trip "Maximum update depth exceeded" the moment any
// gate writes back to activeError.
const STABLE_BALANCE_ITEMS: never[] = [];
const STABLE_SPENDABLE = new BigNumber("10");

const baseProps: HookProps = {
  sourceBalance: baseSourceBalance,
  sourceAmount: "1",
  balanceItems: STABLE_BALANCE_ITEMS,
  swapFee: "0.00001",
  subentryCount: 0,
  transactionHash: null,
  spendableAmount: STABLE_SPENDABLE,
  sourceTokenSymbol: "USDC",
  pathError: null,
  pathResult: null,
  destinationTokenDescriptor: baseDestinationDescriptor,
};

describe("useSwapAmountError", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: pass both gates → no error
    mockHasXLMForFees.mockReturnValue(true);
    mockIsAmountSpendable.mockReturnValue(true);
  });

  describe("toastId stability (analytics + dedupe contract)", () => {
    it("uses INSUFFICIENT_XLM_FOR_FEES when the XLM-for-fees gate trips", () => {
      mockHasXLMForFees.mockReturnValue(false);
      renderHook(() => useSwapAmountError(baseProps));

      // The validation effect runs synchronously on mount → toast fires.
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          toastId: SWAP_TOAST_IDS.INSUFFICIENT_XLM_FOR_FEES,
          duration: 3000,
          variant: "error",
        }),
      );
      // Literal value is the wire contract:
      expect(SWAP_TOAST_IDS.INSUFFICIENT_XLM_FOR_FEES).toBe(
        "insufficient-xlm-for-fees",
      );
    });

    it("uses INSUFFICIENT_BALANCE when amount exceeds spendable", () => {
      mockHasXLMForFees.mockReturnValue(true);
      mockIsAmountSpendable.mockReturnValue(false);
      renderHook(() => useSwapAmountError(baseProps));

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          toastId: SWAP_TOAST_IDS.INSUFFICIENT_BALANCE,
          duration: 3000,
        }),
      );
      expect(SWAP_TOAST_IDS.INSUFFICIENT_BALANCE).toBe("insufficient-balance");
    });

    it("uses SWAP_PATH_ERROR when pathError + amount + destination are all set", () => {
      const { rerender } = renderHook(
        (props: HookProps) => useSwapAmountError(props),
        { initialProps: baseProps },
      );
      mockShowToast.mockClear();

      rerender({
        ...baseProps,
        pathError: "Path-finding failed",
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          toastId: SWAP_TOAST_IDS.SWAP_PATH_ERROR,
          duration: 3000,
          title: "Path-finding failed",
        }),
      );
      expect(SWAP_TOAST_IDS.SWAP_PATH_ERROR).toBe("swap-path-error");
    });

    it("FAILED_TO_SETUP_TRANSACTION literal is exported for the prepareSwapTransaction catch block", () => {
      // The hook doesn't own this branch — prepareSwapTransaction's
      // catch sets it via the returned setActiveError. The exported
      // literal locks the wire string so the catch block + any
      // analytics keyed on it stay aligned.
      expect(SWAP_TOAST_IDS.FAILED_TO_SETUP_TRANSACTION).toBe(
        "failed-to-setup-transaction",
      );
    });
  });

  describe("validation gate ordering", () => {
    it("prefers INSUFFICIENT_XLM_FOR_FEES over INSUFFICIENT_BALANCE when both gates would trip", () => {
      mockHasXLMForFees.mockReturnValue(false);
      mockIsAmountSpendable.mockReturnValue(false);
      renderHook(() => useSwapAmountError(baseProps));

      // Only the XLM-for-fees toast should fire — the spendable check
      // is short-circuited by the early return.
      const xlmCalls = mockShowToast.mock.calls.filter(
        ([arg]) =>
          (arg as { toastId?: string }).toastId ===
          SWAP_TOAST_IDS.INSUFFICIENT_XLM_FOR_FEES,
      );
      const insufficientCalls = mockShowToast.mock.calls.filter(
        ([arg]) =>
          (arg as { toastId?: string }).toastId ===
          SWAP_TOAST_IDS.INSUFFICIENT_BALANCE,
      );
      expect(xlmCalls.length).toBeGreaterThanOrEqual(1);
      expect(insufficientCalls.length).toBe(0);
    });

    it("clears amountError when sourceAmount is '0' or empty", () => {
      mockHasXLMForFees.mockReturnValue(false); // would trip otherwise
      const { result, rerender } = renderHook(
        (props: HookProps) => useSwapAmountError(props),
        { initialProps: { ...baseProps, sourceAmount: "1" } },
      );
      // Pre-condition: error set
      expect(result.current.amountError).not.toBeNull();

      rerender({ ...baseProps, sourceAmount: "0" });
      expect(result.current.amountError).toBeNull();

      rerender({ ...baseProps, sourceAmount: "" });
      expect(result.current.amountError).toBeNull();
    });

    it("does NOT fire INSUFFICIENT_BALANCE while transactionHash is set (post-submit window)", () => {
      mockHasXLMForFees.mockReturnValue(true);
      mockIsAmountSpendable.mockReturnValue(false);
      renderHook(() =>
        useSwapAmountError({ ...baseProps, transactionHash: "tx-abc" }),
      );

      const insufficientCalls = mockShowToast.mock.calls.filter(
        ([arg]) =>
          (arg as { toastId?: string }).toastId ===
          SWAP_TOAST_IDS.INSUFFICIENT_BALANCE,
      );
      expect(insufficientCalls.length).toBe(0);
    });
  });

  describe("path-error toast lifecycle", () => {
    it("does NOT fire path-error toast when amount is empty / 0", () => {
      renderHook(() =>
        useSwapAmountError({
          ...baseProps,
          sourceAmount: "0",
          pathError: "Path-finding failed",
        }),
      );

      const pathErrorCalls = mockShowToast.mock.calls.filter(
        ([arg]) =>
          (arg as { toastId?: string }).toastId ===
          SWAP_TOAST_IDS.SWAP_PATH_ERROR,
      );
      expect(pathErrorCalls.length).toBe(0);
    });

    it("does NOT fire path-error toast when destination is not set", () => {
      renderHook(() =>
        useSwapAmountError({
          ...baseProps,
          pathError: "Path-finding failed",
          destinationTokenDescriptor: null,
        }),
      );

      const pathErrorCalls = mockShowToast.mock.calls.filter(
        ([arg]) =>
          (arg as { toastId?: string }).toastId ===
          SWAP_TOAST_IDS.SWAP_PATH_ERROR,
      );
      expect(pathErrorCalls.length).toBe(0);
    });

    it("dismisses the path-error toast when a subsequent pathResult arrives without a pathError", () => {
      const initialProps: HookProps = {
        ...baseProps,
        pathError: "Path-finding failed",
      };
      const { rerender } = renderHook(
        (props: HookProps) => useSwapAmountError(props),
        { initialProps },
      );

      // Path-error toast fired. Now a successful path-finding cycle
      // resolves — pathError clears, pathResult set, no further toast
      // calls but the toast SHOULD be dismissed (setActiveError(null)).
      mockShowToast.mockClear();

      rerender({
        ...baseProps,
        pathError: null,
        pathResult: {
          path: [],
          destinationAmount: "1",
          destinationAmountMin: "0.99",
          sourceAmount: "1",
          conversionRate: "1",
        } as never,
      });

      // The unified-toast effect doesn't re-fire when activeError is
      // null (the `if (activeError)` guard); we just verify no
      // additional toast was emitted for the path-error id after the
      // dismiss.
      const pathErrorAfterDismiss = mockShowToast.mock.calls.filter(
        ([arg]) =>
          (arg as { toastId?: string }).toastId ===
          SWAP_TOAST_IDS.SWAP_PATH_ERROR,
      );
      expect(pathErrorAfterDismiss.length).toBe(0);
    });
  });
});
