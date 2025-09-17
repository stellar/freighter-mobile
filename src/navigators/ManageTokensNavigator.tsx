/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import AddTokenScreen from "components/screens/AddTokenScreen";
import ManageTokensScreen from "components/screens/ManageTokensScreen";
import {
  MANAGE_TOKENS_ROUTES,
  ManageTokensStackParamList,
} from "config/routes";
import { getScreenBottomNavigateOptions } from "helpers/navigationOptions";
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
        options={getScreenBottomNavigateOptions(t("manageTokensScreen.title"))}
      />
      <ManageTokensStack.Screen
        name={MANAGE_TOKENS_ROUTES.ADD_TOKEN_SCREEN}
        component={AddTokenScreen}
        options={getScreenBottomNavigateOptions(t("addTokenScreen.title"))}
      />
    </ManageTokensStack.Navigator>
  );
};
