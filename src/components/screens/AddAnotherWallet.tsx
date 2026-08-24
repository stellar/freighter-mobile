import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

type AddAnotherWalletScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.ADD_ANOTHER_WALLET_SCREEN
>;

const AddAnotherWalletScreen: React.FC<AddAnotherWalletScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const handleCreateAccount = () => {
    navigation.navigate(MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN);
  };

  const handleImportSecretKey = () => {
    navigation.navigate(MANAGE_WALLETS_ROUTES.IMPORT_SECRET_KEY_SCREEN);
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="pt-8">
        <TouchableOpacity
          className="bg-background-tertiary rounded-2xl p-5"
          onPress={handleCreateAccount}
        >
          <Icon.PlusCircle
            themeColor="lilac"
            size={20}
            circle
            circleBackground={themeColors.lilac[3]}
            circleBorder={themeColors.lilac[6]}
          />
          <View className="h-2" />
          <Text md primary medium>
            {t("addAnotherWalletScreen.actions.createNewWallet")}
          </Text>
          <Text sm secondary medium>
            {t("addAnotherWalletScreen.actions.createNewWalletDescription")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-background-tertiary rounded-2xl p-5 mt-7"
          onPress={handleImportSecretKey}
        >
          <Icon.Download01
            themeColor="lilac"
            size={20}
            circle
            circleBackground={themeColors.lilac[3]}
            circleBorder={themeColors.lilac[6]}
          />
          <View className="h-2" />
          <Text md primary medium>
            {t("addAnotherWalletScreen.actions.importSecretKey")}
          </Text>
          <Text sm secondary medium>
            {t("addAnotherWalletScreen.actions.importSecretKeyDescription")}
          </Text>
        </TouchableOpacity>
      </View>
    </BaseLayout>
  );
};

export default AddAnotherWalletScreen;
