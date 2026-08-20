/* eslint-disable @fnando/consistent-import/consistent-import */
import { NavigationContainer } from "@react-navigation/native";
import { act } from "@testing-library/react-native";
import { MIN_TRANSACTION_FEE } from "config/constants";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { renderWithProviders } from "helpers/testUtils";
import { EarnStackNavigator } from "navigators/EarnNavigator";
import React from "react";

const mockClearNetworkFeesCache = jest.fn();

// The real hook fetches network fees over the network — stub it out so the
// test only exercises the navigator's own mount/unmount wiring, and so we
// can assert on `clearNetworkFeesCache` directly.
jest.mock("hooks/useNetworkFees", () => ({
  useNetworkFees: () => ({
    recommendedFee: "",
    networkCongestion: "low",
    feePresets: {},
  }),
  clearNetworkFeesCache: () => mockClearNetworkFeesCache(),
}));

// `@react-navigation/native-stack` is globally mocked in jest.setup.js
// (Navigator renders children as-is, Screen is a bare jest.fn()), so neither
// EarnTokenPickerScreen nor EarnAmountScreen actually mounts here — this
// test exercises only EarnStackNavigator's own effects.
describe("EarnStackNavigator teardown", () => {
  beforeEach(() => {
    mockClearNetworkFeesCache.mockClear();
    act(() => {
      useTransactionSettingsStore.getState().resetSettings();
      useTransactionBuilderStore.getState().resetTransaction();
    });
  });

  it("resets the shared transaction-settings + builder stores and clears the network-fee cache on unmount", () => {
    // Simulate a fee the user manually customized in a DIFFERENT flow
    // (Send) that shares this same global store — this is exactly the leak
    // scenario the teardown guards against: without it, Earn would silently
    // inherit Send's stale custom inclusion fee.
    act(() => {
      useTransactionSettingsStore.getState().saveTransactionFee("5");
      useTransactionSettingsStore.getState().markFeeManuallyChanged();
      useTransactionBuilderStore.setState({
        transactionXDR: "stale-xdr-from-another-flow",
      });
    });

    const { unmount } = renderWithProviders(
      <NavigationContainer>
        <EarnStackNavigator />
      </NavigationContainer>,
    );

    // Not reset merely by mounting — only on unmount.
    expect(useTransactionSettingsStore.getState().transactionFee).toBe("5");
    expect(useTransactionBuilderStore.getState().transactionXDR).toBe(
      "stale-xdr-from-another-flow",
    );
    expect(mockClearNetworkFeesCache).not.toHaveBeenCalled();

    act(() => {
      unmount();
    });

    expect(useTransactionSettingsStore.getState().transactionFee).toBe(
      MIN_TRANSACTION_FEE,
    );
    expect(useTransactionSettingsStore.getState().feeManuallyChanged).toBe(
      false,
    );
    expect(useTransactionBuilderStore.getState().transactionXDR).toBeNull();
    expect(mockClearNetworkFeesCache).toHaveBeenCalledTimes(1);
  });
});
