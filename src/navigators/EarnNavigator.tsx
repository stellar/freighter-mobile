/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import {
  EarnAmountScreen,
  EarnTokenPickerScreen,
} from "components/screens/EarnScreen/screens";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { useEarnStore } from "ducks/earn";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import {
  getScreenOptionsWithCustomHeader,
  getStackBottomNavigateOptions,
} from "helpers/navigationOptions";
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

  // Reset earn-flow state when the whole flow unmounts, so EVERY exit path
  // (X, hardware/gesture back, or programmatic) leaves a clean slate.
  // `transactionFee`/`transactionTimeout` come from the SHARED
  // `useTransactionSettingsStore` (Earn reuses TransactionContext.Send rather
  // than a dedicated context, see EarnAmountScreen), so without this reset a
  // fee the user manually customized in Send would silently leak into Earn's
  // deposit — a real risk given Earn's resource fee runs ~5,000x the
  // inclusion fee. Also clears the frozen network-fee snapshot so the next
  // flow re-fetches fresh values.
  //
  // `useEarnStore.resetEarn()` is Earn's equivalent of
  // `SendPaymentNavigator`'s `useSendRecipientStore.resetSendRecipient()` —
  // its own domain duck, reset here for the same reason: prior to this fix,
  // `resetEarn()` was only ever called from the success "Done" handler, so
  // every other exit (back from the picker, back from Amount, close-while-
  // submitting, error -> back -> out) left `pool`/asset selection,
  // `currentPositionTokens`, and `lastSubmitFailed` populated for a later,
  // unrelated Earn session to inherit.
  useEffect(
    () => () => {
      useTransactionSettingsStore.getState().resetSettings();
      useTransactionBuilderStore.getState().resetTransaction();
      useEarnStore.getState().resetEarn();
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
        // The screen draws its own bare-X header and keeps its title in the
        // body (the intro it can render in its place does the same), so the
        // stack header would double up on both. `getStackBottomNavigateOptions`
        // still supplies the slide-from-bottom animation.
        options={{ ...getStackBottomNavigateOptions(), headerShown: false }}
      />
      <EarnStack.Screen
        name={EARN_ROUTES.EARN_AMOUNT_SCREEN}
        component={EarnAmountScreen}
        // The header's X leaves Earn, like the picker's: the parent stack
        // pops the whole Earn flow, and the unmount effect above resets it.
        // The token pill on the amount card is the way back to the picker.
        options={({ navigation }) => ({
          ...getScreenOptionsWithCustomHeader(t("earnAmount.title")),
          headerLeft: () => (
            <CustomHeaderButton
              variant="close"
              onPress={() => navigation.getParent()?.goBack()}
              testID="earn-amount-close"
            />
          ),
        })}
      />
    </EarnStack.Navigator>
  );
};
