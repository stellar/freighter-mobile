/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import {
  EarnAmountScreen,
  EarnTokenPickerScreen,
} from "components/screens/EarnScreen/screens";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { getScreenBottomNavigateOptions } from "helpers/navigationOptions";
import useAppTranslation from "hooks/useAppTranslation";
import { clearNetworkFeesCache, useNetworkFees } from "hooks/useNetworkFees";
import React, { useEffect } from "react";

const EarnStack = createNativeStackNavigator<EarnStackParamList>();

export const EarnStackNavigator = () => {
  const { t } = useAppTranslation();

  // Prewarm the network-fee snapshot on flow entry so the amount screen and
  // review read frozen values from cache rather than fetching (and flickering)
  // on open. Same rationale as SwapNavigator.
  useNetworkFees();

  // Reset earn-flow fee/transaction state when the whole flow unmounts, so
  // EVERY exit path (X, hardware/gesture back, or programmatic) leaves a
  // clean slate — matches SendPaymentNavigator's teardown. `transactionFee`/
  // `transactionTimeout` come from the SHARED `useTransactionSettingsStore`
  // (Earn reuses TransactionContext.Send rather than a dedicated context,
  // see EarnAmountScreen), so without this reset a fee the user manually
  // customized in Send would silently leak into Earn's deposit — a real risk
  // given Earn's resource fee runs ~5,000x the inclusion fee. Also clears the
  // frozen network-fee snapshot so the next flow re-fetches fresh values.
  useEffect(
    () => () => {
      useTransactionSettingsStore.getState().resetSettings();
      useTransactionBuilderStore.getState().resetTransaction();
      clearNetworkFeesCache();
    },
    [],
  );

  return (
    <EarnStack.Navigator
      initialRouteName={EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN}
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <EarnStack.Screen
        name={EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN}
        component={EarnTokenPickerScreen}
        options={getScreenBottomNavigateOptions(t("earnTokenPicker.title"))}
      />
      <EarnStack.Screen
        name={EARN_ROUTES.EARN_AMOUNT_SCREEN}
        component={EarnAmountScreen}
        options={getScreenBottomNavigateOptions(t("earnAmount.title"))}
      />
    </EarnStack.Navigator>
  );
};
