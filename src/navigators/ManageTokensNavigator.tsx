/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import AddTokenScreen from "components/screens/AddTokenScreen";
import ManageTokensScreen from "components/screens/ManageTokensScreen";
import Icon from "components/sds/Icon";
import {
  MANAGE_TOKENS_ROUTES,
  ManageTokensStackParamList,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

const ManageTokensStack =
  createNativeStackNavigator<ManageTokensStackParamList>();

export const ManageTokensStackNavigator = () => {
  const { t } = useAppTranslation();

  return (
    <ManageTokensStack.Navigator
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <ManageTokensStack.Screen
        name={MANAGE_TOKENS_ROUTES.MANAGE_TOKENS_SCREEN}
        component={ManageTokensScreen}
        options={{
          headerTitle: t("manageTokensScreen.title"),
          headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
        }}
      />
      <ManageTokensStack.Screen
        name={MANAGE_TOKENS_ROUTES.ADD_TOKEN_SCREEN}
        component={AddTokenScreen}
        options={{
          headerTitle: t("addTokenScreen.title"),
          headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
        }}
      />
    </ManageTokensStack.Navigator>
  );
};
