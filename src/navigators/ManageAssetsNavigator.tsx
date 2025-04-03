/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import ManageAssetsScreen from "components/screens/ManageAssetsScreen";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import React from "react";

const ManageAssetsStack =
  createNativeStackNavigator<ManageAssetsStackParamList>();

export const ManageAssetsStackNavigator = () => (
  <ManageAssetsStack.Navigator
    screenOptions={{
      header: (props) => <CustomNavigationHeader {...props} />,
    }}
  >
    <ManageAssetsStack.Screen
      name={MANAGE_ASSETS_ROUTES.MANAGE_ASSETS_SCREEN}
      component={ManageAssetsScreen}
    />
  </ManageAssetsStack.Navigator>
);
