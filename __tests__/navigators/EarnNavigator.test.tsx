/* eslint-disable @fnando/consistent-import/consistent-import */
import { NavigationContainer } from "@react-navigation/native";
import { act } from "@testing-library/react-native";
import { MIN_TRANSACTION_FEE } from "config/constants";
import { useEarnStore } from "ducks/earn";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
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
      useEarnStore.getState().resetEarn();
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

  // FIX 1: prior to this fix, `resetEarn()` was only ever called from the
  // success-Done handler — every other exit (back from the picker, back
  // from Amount, close-while-submitting, error -> back -> out) left the
  // earn duck populated, which meant a stale `currentPositionTokens`
  // "before" value could leak
  // into a later, unrelated Earn session. Verifies the teardown clears the
  // duck on every unmount, matching the other two stores above.
  it("resets the earn duck on unmount", () => {
    act(() => {
      useEarnStore.getState().setPool({ id: "CPOOL", name: "Fixed" } as never);
      useEarnStore.getState().selectAsset({
        assetId: "CASSET",
        apy: 0.05,
        code: "USDC",
        decimals: 7,
      });
      useEarnStore.getState().setCurrentPositionTokens("5000000000");
    });

    const { unmount } = renderWithProviders(
      <NavigationContainer>
        <EarnStackNavigator />
      </NavigationContainer>,
    );

    // Not reset merely by mounting — only on unmount, same as the stores above.
    expect(useEarnStore.getState().pool).toEqual({
      id: "CPOOL",
      name: "Fixed",
    });

    act(() => {
      unmount();
    });

    const state = useEarnStore.getState();
    expect(state.pool).toBeNull();
    expect(state.selectedAssetId).toBe("");
    expect(state.currentPositionTokens).toBe("0");
  });

  // The Earn swap shares the swap store and its settings with main Swap.
  // Leaving Earn clears both, as main Swap does when it closes, so neither
  // inherits the other's half-finished swap.
  it("resets the swap store and swap settings on unmount", () => {
    act(() => {
      useSwapStore.getState().setSourceToken("XLM", "XLM");
      useSwapStore.getState().setSourceAmount("12");
      useSwapSettingsStore.getState().saveSwapSlippage(7);
    });

    const { unmount } = renderWithProviders(
      <NavigationContainer>
        <EarnStackNavigator />
      </NavigationContainer>,
    );

    expect(useSwapStore.getState().sourceTokenId).toBe("XLM");

    act(() => {
      unmount();
    });

    expect(useSwapStore.getState().sourceTokenId).toBe("");
    expect(useSwapStore.getState().sourceAmount).toBe("0");
    expect(useSwapSettingsStore.getState().swapSlippage).not.toBe(7);
  });
});
