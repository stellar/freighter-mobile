/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import AccountQRCodeScreen from "components/screens/AccountQRCodeScreen";
import BuyXLMScreen from "components/screens/BuyXLMScreen";
import Icon from "components/sds/Icon";
import {
  BUY_XLM_ROUTES,
  BuyXLMStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

const BuyXLMStack = createNativeStackNavigator<BuyXLMStackParamList>();

export const BuyXLMStackNavigator = () => {
  const { t } = useAppTranslation();

  return (
    <BuyXLMStack.Navigator
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <BuyXLMStack.Screen
        name={BUY_XLM_ROUTES.BUY_XLM_SCREEN}
        component={BuyXLMScreen}
        options={{
          headerTitle: t("buyXLMScreen.title"),
          headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
        }}
      />
      <BuyXLMStack.Screen
        name={ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN}
        component={AccountQRCodeScreen}
        options={{
          headerTitle: t("accountQRCodeScreen.title"),
          // Let's explicitly set the left header button as the "arrow left" icon
          // here so that it becomes more clear on why it could be set to the "X"
          // icon on the AccountQRCodeScreen component itself.
          headerLeft: () => <CustomHeaderButton icon={Icon.ArrowLeft} />,
        }}
      />
    </BuyXLMStack.Navigator>
  );
};
