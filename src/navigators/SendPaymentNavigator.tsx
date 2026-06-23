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
import {
  ScreenTransition,
  SEND_PAYMENT_ROUTES,
  SendPaymentStackParamList,
} from "config/routes";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { withTransitionOverride } from "helpers/navigationOptions";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect } from "react";

const SendPaymentStack =
  createNativeStackNavigator<SendPaymentStackParamList>();

const closeSendFlow = (
  navigation: {
    goBack: () => void;
    getParent: () => { goBack: () => void } | undefined;
  },
  dismissToPreviousScreen?: boolean,
  transition?: ScreenTransition,
) => {
  const isBottomSheetOverlay =
    dismissToPreviousScreen && transition === ScreenTransition.SlideFromBottom;

  if (isBottomSheetOverlay) {
    navigation.goBack();
    return;
  }

  useSendRecipientStore.getState().resetSendRecipient();
  useTransactionSettingsStore.getState().resetSettings();
  useTransactionBuilderStore.getState().resetTransaction();
  navigation.getParent()?.goBack();
};

export const SendPaymentStackNavigator = () => {
  const { t } = useAppTranslation();

  // Reset send-flow state when the whole flow unmounts, so EVERY exit path
  // (X button, hardware/gesture back, or programmatic) leaves a clean slate —
  // e.g. the fee priority tier defaults back to Med on the next entry. The X
  // button (closeSendFlow) resets eagerly too; this is the catch-all that also
  // covers back-navigation. (The Swap flow already does this via its root
  // screen's unmount effect.)
  useEffect(
    () => () => {
      useSendRecipientStore.getState().resetSendRecipient();
      useTransactionSettingsStore.getState().resetSettings();
      useTransactionBuilderStore.getState().resetTransaction();
    },
    [],
  );

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
            route.params?.dismissToPreviousScreen
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
                  onPress={() =>
                    closeSendFlow(
                      navigation,
                      route.params?.dismissToPreviousScreen,
                      route.params?.transition,
                    )
                  }
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
        options={({ route }) =>
          withTransitionOverride(
            {
              headerTitle: t("transactionAmountScreen.title"),
            },
            route,
          )
        }
      />
      <SendPaymentStack.Screen
        name={SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW}
        component={SendCollectibleReviewScreen}
        options={({ route, navigation }) =>
          withTransitionOverride(
            {
              headerTitle: t("transactionAmountScreen.title"),
              headerLeft: () => (
                <CustomHeaderButton
                  icon={Icon.X}
                  onPress={() =>
                    closeSendFlow(
                      navigation,
                      route.params?.dismissToPreviousScreen,
                      route.params?.transition,
                    )
                  }
                />
              ),
            },
            route,
          )
        }
      />
    </SendPaymentStack.Navigator>
  );
};
