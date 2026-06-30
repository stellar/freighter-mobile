import { act, renderHook } from "@testing-library/react-hooks";
import { MIN_TRANSACTION_FEE, TransactionContext } from "config/constants";
import { FeePriority, NetworkCongestion } from "config/types";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { useInitialRecommendedFee } from "hooks/useInitialRecommendedFee";

describe("useInitialRecommendedFee", () => {
  beforeEach(() => {
    act(() => {
      useTransactionSettingsStore.getState().resetSettings();
      useSwapSettingsStore.getState().resetSettings();
    });
  });

  afterEach(() => {
    act(() => {
      useTransactionSettingsStore.getState().resetSettings();
      useSwapSettingsStore.getState().resetSettings();
    });
  });

  it("does not overwrite a manually changed send fee when the recommended fee changes", () => {
    const { result, rerender } = renderHook(
      ({ recommendedFee }: { recommendedFee: string }) =>
        useInitialRecommendedFee(recommendedFee, TransactionContext.Send),
      {
        initialProps: { recommendedFee: MIN_TRANSACTION_FEE },
      },
    );

    expect(useTransactionSettingsStore.getState().transactionFee).toBe(
      MIN_TRANSACTION_FEE,
    );

    act(() => {
      result.current.markAsManuallyChanged();
      useTransactionSettingsStore.getState().saveTransactionFee("0.1234567");
    });

    rerender({ recommendedFee: "0.5000000" });

    expect(useTransactionSettingsStore.getState().transactionFee).toBe(
      "0.1234567",
    );
  });

  it("shares the manually-changed flag across multiple mounted instances", () => {
    // Mount two instances of the hook simultaneously (as happens in the send flow
    // where the hook is used in TransactionAmountScreen and FeeSelector at once).
    const { result: result1, rerender: rerender1 } = renderHook(
      ({ recommendedFee }: { recommendedFee: string }) =>
        useInitialRecommendedFee(recommendedFee, TransactionContext.Send),
      { initialProps: { recommendedFee: MIN_TRANSACTION_FEE } },
    );
    renderHook(
      ({ recommendedFee }: { recommendedFee: string }) =>
        useInitialRecommendedFee(recommendedFee, TransactionContext.Send),
      { initialProps: { recommendedFee: MIN_TRANSACTION_FEE } },
    );

    // User manually changes the fee via the first instance.
    act(() => {
      result1.current.markAsManuallyChanged();
      useTransactionSettingsStore.getState().saveTransactionFee("0.1234567");
    });

    // A new recommended fee arrives — neither instance should overwrite the
    // user's manual value because the flag is stored in the shared Zustand store.
    rerender1({ recommendedFee: "0.5000000" });

    expect(useTransactionSettingsStore.getState().transactionFee).toBe(
      "0.1234567",
    );
  });

  it("scales the recommended fee by operationCount so the stored fee is the total (2-op swap)", () => {
    renderHook(() =>
      useInitialRecommendedFee("0.001", TransactionContext.Swap, 2),
    );

    // The per-op recommended 0.001 becomes a 0.002 total across 2 ops.
    expect(useSwapSettingsStore.getState().swapFee).toBe("0.002");
  });

  it("writes the unscaled recommended fee for a single operation (default)", () => {
    renderHook(() =>
      useInitialRecommendedFee("0.001", TransactionContext.Send),
    );

    expect(useTransactionSettingsStore.getState().transactionFee).toBe("0.001");
  });

  it("defaults the fee priority tier to match network congestion (1:1)", () => {
    (
      [
        [NetworkCongestion.LOW, FeePriority.LOW],
        [NetworkCongestion.MEDIUM, FeePriority.MEDIUM],
        [NetworkCongestion.HIGH, FeePriority.HIGH],
      ] as const
    ).forEach(([congestion, expectedTier]) => {
      act(() => {
        useTransactionSettingsStore.getState().resetSettings();
      });

      renderHook(() =>
        useInitialRecommendedFee(
          "0.001",
          TransactionContext.Send,
          1,
          congestion,
        ),
      );

      expect(useTransactionSettingsStore.getState().feePriority).toBe(
        expectedTier,
      );
    });
  });

  it("stops re-defaulting the tier once the fee is manually changed", () => {
    const { result, rerender } = renderHook(
      ({ congestion }: { congestion: NetworkCongestion }) =>
        useInitialRecommendedFee(
          "0.001",
          TransactionContext.Send,
          1,
          congestion,
        ),
      { initialProps: { congestion: NetworkCongestion.LOW } },
    );

    expect(useTransactionSettingsStore.getState().feePriority).toBe(
      FeePriority.LOW,
    );

    act(() => {
      result.current.markAsManuallyChanged();
      useTransactionSettingsStore
        .getState()
        .saveFeePriority(FeePriority.CUSTOM);
    });

    // Congestion rises, but the user's chosen tier is preserved.
    rerender({ congestion: NetworkCongestion.HIGH });

    expect(useTransactionSettingsStore.getState().feePriority).toBe(
      FeePriority.CUSTOM,
    );
  });
});
