import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AddWalletOption, {
  ADD_WALLET_OPTION_ICON_SIZE,
} from "components/AddWalletOption";
import ScreenTitle from "components/ScreenTitle";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

type AddAnotherWalletScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.ADD_ANOTHER_WALLET_SCREEN
>;

/**
 * The ways to add a wallet, opened from the account switcher's Add wallet:
 * create, import a further recovery phrase, or import a secret key. None of
 * them replaces the wallet. Connecting a hardware wallet is in the design
 * but not offered, since mobile has no hardware support.
 */
const AddAnotherWalletScreen: React.FC<AddAnotherWalletScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const iconColor = themeColors.foreground.secondary;

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="mt-2">
        <ScreenTitle
          title={t("addAnotherWalletScreen.title")}
          subtitle={t("addAnotherWalletScreen.subtitle")}
        />
        <View className="gap-3">
          <AddWalletOption
            icon={
              <Icon.Plus size={ADD_WALLET_OPTION_ICON_SIZE} color={iconColor} />
            }
            title={t("addAnotherWalletScreen.actions.createNewWallet")}
            description={t(
              "addAnotherWalletScreen.actions.createNewWalletDescription",
            )}
            onPress={() =>
              navigation.navigate(MANAGE_WALLETS_ROUTES.CREATE_WALLET_SCREEN)
            }
            testID="add-wallet-create"
          />
          <AddWalletOption
            icon={
              <Icon.Passcode
                size={ADD_WALLET_OPTION_ICON_SIZE}
                color={iconColor}
              />
            }
            title={t("addAnotherWalletScreen.actions.importRecoveryPhrase")}
            description={t(
              "addAnotherWalletScreen.actions.importRecoveryPhraseDescription",
            )}
            onPress={() =>
              navigation.navigate(
                MANAGE_WALLETS_ROUTES.IMPORT_RECOVERY_PHRASE_SCREEN,
              )
            }
            testID="add-wallet-import-phrase"
          />
          <AddWalletOption
            icon={
              <Icon.Key01
                size={ADD_WALLET_OPTION_ICON_SIZE}
                color={iconColor}
              />
            }
            title={t("addAnotherWalletScreen.actions.importSecretKey")}
            description={t(
              "addAnotherWalletScreen.actions.importSecretKeyDescription",
            )}
            onPress={() =>
              navigation.navigate(
                MANAGE_WALLETS_ROUTES.IMPORT_SECRET_KEY_SCREEN,
              )
            }
            testID="add-wallet-import-secret-key"
          />
        </View>
      </View>
    </BaseLayout>
  );
};

export default AddAnotherWalletScreen;
