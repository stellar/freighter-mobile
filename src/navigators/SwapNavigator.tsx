/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import SwapScreen from "components/screens/SwapScreen";
import { SwapAmountScreen } from "components/screens/SwapScreen/screens";
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
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <SwapStack.Screen
        name={SWAP_ROUTES.SWAP_SCREEN}
        component={SwapScreen}
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
        options={{
          headerTitle: t("swapScreen.title"),
        }}
      />
    </SwapStack.Navigator>
  );
};
