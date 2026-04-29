import { act, renderHook } from "@testing-library/react-hooks";
import { MIN_TRANSACTION_FEE, TransactionContext } from "config/constants";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { useInitialRecommendedFee } from "hooks/useInitialRecommendedFee";

describe("useInitialRecommendedFee", () => {
  beforeEach(() => {
    act(() => {
      useTransactionSettingsStore.getState().resetSettings();
    });
  });

  afterEach(() => {
    act(() => {
      useTransactionSettingsStore.getState().resetSettings();
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
});
