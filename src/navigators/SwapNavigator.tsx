/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import SwapScreen from "components/screens/SwapScreen";
import {
  SwapAmountScreen,
  SwapFeeScreen,
  SwapSlippageScreen,
  SwapTimeoutScreen,
} from "components/screens/SwapScreen/screens";
import Icon from "components/sds/Icon";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

const SwapStack = createNativeStackNavigator<SwapStackParamList>();

export const SwapStackNavigator = () => {
  const { t } = useAppTranslation();

  return (
    <SwapStack.Navigator
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <SwapStack.Screen
        name={SWAP_ROUTES.SWAP_SCREEN}
        component={SwapScreen}
        options={{
          headerTitle: t("swapScreen.swapFrom"),
          headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
        }}
      />
      <SwapStack.Screen
        name={SWAP_ROUTES.SWAP_AMOUNT_SCREEN}
        component={SwapAmountScreen}
        options={{
          headerTitle: t("swapScreen.title"),
        }}
      />
      <SwapStack.Screen
        name={SWAP_ROUTES.SWAP_FEE_SCREEN}
        component={SwapFeeScreen}
        options={{
          headerTitle: t("transactionFeeScreen.title"),
        }}
      />
      <SwapStack.Screen
        name={SWAP_ROUTES.SWAP_TIMEOUT_SCREEN}
        component={SwapTimeoutScreen}
        options={{
          headerTitle: t("transactionTimeoutScreen.title"),
        }}
      />
      <SwapStack.Screen
        name={SWAP_ROUTES.SWAP_SLIPPAGE_SCREEN}
        component={SwapSlippageScreen}
        options={{
          headerTitle: "Allowed Slippage",
        }}
      />
    </SwapStack.Navigator>
  );
};
