/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import { SendHome } from "components/screens/SendScreen";
import {
  MemoScreen,
  TransactionDetailScreen,
  TransactionFeeScreen,
  TransactionTimeoutScreen,
  TransactionAmountScreen,
} from "components/screens/SendScreen/screens";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

const SendPaymentStack =
  createNativeStackNavigator<SendPaymentStackParamList>();

export const SendPaymentStackNavigator = () => {
  const { t } = useAppTranslation();

  return (
    <SendPaymentStack.Navigator
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN}
        component={SendHome}
        options={{
          headerTitle: t("sendPaymentScreen.title"),
        }}
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.TRANSACTION_DETAIL_SCREEN}
        component={TransactionDetailScreen}
        options={{
          headerTitle: t("transactionDetailScreen.title"),
        }}
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN}
        component={TransactionAmountScreen}
        options={{
          headerTitle: t("transactionAmountScreen.title"),
        }}
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.TRANSACTION_MEMO_SCREEN}
        component={MemoScreen}
        options={{
          headerTitle: t("transactionMemoScreen.title"),
        }}
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.TRANSACTION_TIMEOUT_SCREEN}
        component={TransactionTimeoutScreen}
        options={{
          headerTitle: t("transactionTimeoutScreen.title"),
        }}
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.TRANSACTION_FEE_SCREEN}
        component={TransactionFeeScreen}
        options={{
          headerTitle: t("transactionFeeScreen.title"),
        }}
      />
    </SendPaymentStack.Navigator>
  );
};
