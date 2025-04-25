/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import SendPaymentScreen from "components/screens/SendPaymentScreen/SendPaymentScreen";
import TransactionDetailScreen from "components/screens/SendPaymentScreen/TransactionDetailScreen";
import TransactionValueScreen from "components/screens/SendPaymentScreen/TransactionValueScreen";
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
    </SendPaymentStack.Navigator>
  );
};
