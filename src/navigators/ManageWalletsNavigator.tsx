/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import AddAnotherWalletScreen from "components/screens/AddAnotherWallet";
import ImportSecretKeyScreen from "components/screens/ImportSecretKeyScreen";
import VerifyPasswordScreen from "components/screens/VerifyPasswordScreen";
import Icon from "components/sds/Icon";
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
        name={MANAGE_WALLETS_ROUTES.ADD_ANOTHER_WALLET_SCREEN}
        component={AddAnotherWalletScreen}
        options={{
          headerTitle: t("addAnotherWalletScreen.title"),
          headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
        }}
      />
      <ManageWalletsStack.Screen
        name={MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN}
        component={VerifyPasswordScreen}
        options={{
          headerTitle: t("verifyPasswordScreen.title"),
        }}
      />
      <ManageWalletsStack.Screen
        name={MANAGE_WALLETS_ROUTES.IMPORT_SECRET_KEY_SCREEN}
        component={ImportSecretKeyScreen}
        options={{
          headerTitle: "",
        }}
      />
    </ManageWalletsStack.Navigator>
  );
};
