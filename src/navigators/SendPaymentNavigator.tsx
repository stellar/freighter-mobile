/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import { SendSearchContacts } from "components/screens/SendScreen";
import {
  TransactionTokenScreen,
  TransactionAmountScreen,
} from "components/screens/SendScreen/screens";
import SendCollectibleReviewScreen from "components/screens/SendScreen/screens/SendCollectibleReview";
import Icon from "components/sds/Icon";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { withTransitionOverride } from "helpers/navigationOptions";
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
        options={({ route, navigation }) =>
          withTransitionOverride(
            route.params?.returnToSendScreen
              ? {
                  headerTitle: t("sendPaymentScreen.title"),
                  headerLeft: () => (
                    <CustomHeaderButton
                      icon={Icon.X}
                      onPress={() => navigation.goBack()}
                    />
                  ),
                }
              : {
                  headerTitle: t("sendPaymentScreen.title"),
                },
            route,
          )
        }
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN}
        component={TransactionTokenScreen}
        options={({ route, navigation }) =>
          withTransitionOverride(
            {
              headerTitle: t("transactionTokenScreen.title"),
              headerLeft: () => (
                <CustomHeaderButton
                  icon={Icon.X}
                  onPress={() => navigation.goBack()}
                />
              ),
            },
            route,
          )
        }
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN}
        component={TransactionAmountScreen}
        options={{
          headerTitle: t("transactionAmountScreen.title"),
        }}
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW}
        component={SendCollectibleReviewScreen}
        options={{
          headerTitle: t("transactionAmountScreen.title"),
        }}
      />
    </SendPaymentStack.Navigator>
  );
};
