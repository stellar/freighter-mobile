/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import AddAnotherWalletScreen from "components/screens/AddAnotherWallet";
import BackupRecoveryPhraseScreen from "components/screens/BackupRecoveryPhraseScreen";
import CreateWalletScreen from "components/screens/CreateWalletScreen";
import ImportRecoveryPhraseScreen from "components/screens/ImportRecoveryPhraseScreen";
import ImportSecretKeyScreen from "components/screens/ImportSecretKeyScreen";
import VerifyPasswordScreen from "components/screens/VerifyPasswordScreen";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import {
  getStackBottomNavigateOptions,
  resetNestedNavigationOptions,
} from "helpers/navigationOptions";
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
        ...getStackBottomNavigateOptions(),
      }}
    >
      <ManageWalletsStack.Screen
        name={MANAGE_WALLETS_ROUTES.ADD_ANOTHER_WALLET_SCREEN}
        component={AddAnotherWalletScreen}
        options={{
          // The screen sets its own large title, under a close-only header.
          headerTitle: "",
          headerLeft: () => <CustomHeaderButton variant="close" />,
        }}
      />
      <ManageWalletsStack.Screen
        name={MANAGE_WALLETS_ROUTES.CREATE_WALLET_SCREEN}
        component={CreateWalletScreen}
        options={{ headerTitle: "" }}
      />
      <ManageWalletsStack.Screen
        name={MANAGE_WALLETS_ROUTES.BACKUP_RECOVERY_PHRASE_SCREEN}
        component={BackupRecoveryPhraseScreen}
        options={({ navigation }) => ({
          headerTitle: "",
          // Leaves the whole add-wallet flow, as the design's X does.
          headerRight: () => (
            <CustomHeaderButton
              position="right"
              variant="close"
              onPress={() => navigation.getParent()?.goBack()}
              testID="backup-recovery-phrase-close"
            />
          ),
        })}
      />
      <ManageWalletsStack.Screen
        name={MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN}
        component={VerifyPasswordScreen}
        options={resetNestedNavigationOptions(t("verifyPasswordScreen.title"))}
      />
      <ManageWalletsStack.Screen
        name={MANAGE_WALLETS_ROUTES.IMPORT_SECRET_KEY_SCREEN}
        component={ImportSecretKeyScreen}
        options={resetNestedNavigationOptions(t("importSecretKeyScreen.title"))}
      />
      <ManageWalletsStack.Screen
        name={MANAGE_WALLETS_ROUTES.IMPORT_RECOVERY_PHRASE_SCREEN}
        component={ImportRecoveryPhraseScreen}
        // The template sets its own large title.
        options={{ headerTitle: "" }}
      />
    </ManageWalletsStack.Navigator>
  );
};
