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
});
