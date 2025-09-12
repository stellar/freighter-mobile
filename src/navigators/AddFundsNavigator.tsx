/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import AccountQRCodeScreen from "components/screens/AccountQRCodeScreen";
import AddFundsScreen from "components/screens/AddFundsScreen";
import Icon from "components/sds/Icon";
import {
  ADD_FUNDS_ROUTES,
  AddFundsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import {
  getScreenBottomNavigateOptions,
  getStackBottomNavigateOptions,
} from "helpers/navigationOptions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

const AddFundsStack = createNativeStackNavigator<AddFundsStackParamList>();

export const AddFundsStackNavigator = () => {
  const { t } = useAppTranslation();

  return (
    <AddFundsStack.Navigator
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
        ...getStackBottomNavigateOptions(),
      }}
    >
      <AddFundsStack.Screen
        name={ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN}
        component={AddFundsScreen}
        options={{
          headerTitle: t("addFundsScreen.title"),
          headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
        }}
      />
      <AddFundsStack.Screen
        name={ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN}
        component={AccountQRCodeScreen}
        options={getScreenBottomNavigateOptions(t("accountQRCodeScreen.title"))}
      />
    </AddFundsStack.Navigator>
  );
};
