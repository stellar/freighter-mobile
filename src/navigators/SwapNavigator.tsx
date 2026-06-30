/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import {
  SwapAmountScreen,
  SwapToScreen,
} from "components/screens/SwapScreen/screens";
import { SWAP_SELECTION_TYPES } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { getScreenBottomNavigateOptions } from "helpers/navigationOptions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

const SwapStack = createNativeStackNavigator<SwapStackParamList>();

export const SwapStackNavigator = () => {
  const { t } = useAppTranslation();

  return (
    <SwapStack.Navigator
      // The amount screen is the stack root; the token pickers are PUSHED on
      // top so their slide_from_bottom animation has a true inverse on
      // dismiss (goBack = slide-down). Without this the picker was the bottom
      // route, making open/close a rewind that Android snapped through.
      initialRouteName={SWAP_ROUTES.SWAP_AMOUNT_SCREEN}
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <SwapStack.Screen
        name={SWAP_ROUTES.SWAP_SCREEN}
        component={SwapToScreen}
        options={({ route }) =>
          getScreenBottomNavigateOptions(
            route.params.selectionType === SWAP_SELECTION_TYPES.DESTINATION
              ? t("swapScreen.swapTo")
              : t("swapScreen.swapFrom"),
          )
        }
      />
      <SwapStack.Screen
        name={SWAP_ROUTES.SWAP_AMOUNT_SCREEN}
        component={SwapAmountScreen}
        options={getScreenBottomNavigateOptions(t("swapScreen.title"))}
      />
    </SwapStack.Navigator>
  );
};
