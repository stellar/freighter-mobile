/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import AddAssetScreen from "components/screens/AddAssetScreen";
import ManageAssetsScreen from "components/screens/ManageAssetsScreen";
import Icon from "components/sds/Icon";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

const ManageAssetsStack =
  createNativeStackNavigator<ManageAssetsStackParamList>();

export const ManageAssetsStackNavigator = () => {
  const { t } = useAppTranslation();

  return (
    <ManageAssetsStack.Navigator
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <ManageAssetsStack.Screen
        name={MANAGE_ASSETS_ROUTES.MANAGE_ASSETS_SCREEN}
        component={ManageAssetsScreen}
        options={{
          headerTitle: t("manageAssetsScreen.title"),
          headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
        }}
      />
      <ManageAssetsStack.Screen
        name={MANAGE_ASSETS_ROUTES.ADD_ASSET_SCREEN}
        component={AddAssetScreen}
        options={{
          headerTitle: t("addAssetScreen.title"),
          headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
        }}
      />
    </ManageAssetsStack.Navigator>
  );
};
