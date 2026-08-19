/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import { EarnTokenPickerScreen } from "components/screens/EarnScreen/screens";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { getScreenBottomNavigateOptions } from "helpers/navigationOptions";
import useAppTranslation from "hooks/useAppTranslation";
import { useNetworkFees } from "hooks/useNetworkFees";
import React from "react";

const EarnStack = createNativeStackNavigator<EarnStackParamList>();

export const EarnStackNavigator = () => {
  const { t } = useAppTranslation();

  // Prewarm the network-fee snapshot on flow entry so the amount screen and
  // review read frozen values from cache rather than fetching (and flickering)
  // on open. Same rationale as SwapNavigator.
  useNetworkFees();

  return (
    <EarnStack.Navigator
      initialRouteName={EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN}
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <EarnStack.Screen
        name={EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN}
        component={EarnTokenPickerScreen}
        options={getScreenBottomNavigateOptions(t("earnTokenPicker.title"))}
      />
    </EarnStack.Navigator>
  );
};
