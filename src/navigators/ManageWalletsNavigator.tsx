/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import AddAnotherWalletScreen from "components/screens/AddAnotherWallet";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

const ManageWalletsStack =
  createNativeStackNavigator<ManageWalletsStackParamList>();

export const ManageWalletsStackNavigator = () => {
  const { t } = useAppTranslation();

  return (
    <ManageWalletsStack.Navigator
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <ManageWalletsStack.Screen
        name={MANAGE_WALLETS_ROUTES.MANAGE_WALLETS_SCREEN}
        component={AddAnotherWalletScreen}
        options={{
          headerTitle: t("addAnotherWalletScreen.title"),
        }}
      />
    </ManageWalletsStack.Navigator>
  );
};
