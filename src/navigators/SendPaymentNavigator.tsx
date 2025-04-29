/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import SendPaymentScreen from "components/screens/SendPaymentScreen/SendPaymentScreen";
import { 
  MemoScreen,
  TransactionDetailScreen,
  TransactionFeeScreen,
  TransactionTimeoutScreen,
  TransactionValueScreen 
} from "components/screens/SendPaymentScreen/screens";
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
        component={SendPaymentScreen}
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
        name={SEND_PAYMENT_ROUTES.TRANSACTION_VALUE_SCREEN}
        component={TransactionValueScreen}
        options={{
          headerTitle: t("transactionValueScreen.title"),
        }}
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.MEMO_SCREEN}
        component={MemoScreen}
        options={{
          headerTitle: t("memoScreen.title"),
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
