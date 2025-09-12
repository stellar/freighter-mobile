/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import { SendSearchContacts } from "components/screens/SendScreen";
import {
  TransactionMemoScreen,
  TransactionTokenScreen,
  TransactionFeeScreen,
  TransactionTimeoutScreen,
  TransactionAmountScreen,
} from "components/screens/SendScreen/screens";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { getScreenBottomNavigateOptions } from "helpers/navigationOptions";
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
        name={SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN}
        component={SendSearchContacts}
        options={getScreenBottomNavigateOptions(t("sendPaymentScreen.title"))}
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN}
        component={TransactionTokenScreen}
        options={{
          headerTitle: t("transactionTokenScreen.title"),
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
        component={TransactionMemoScreen}
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
