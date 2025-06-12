/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import SwapScreen from "components/screens/SwapScreen";
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
        }}
      />
    </SwapStack.Navigator>
  );
};