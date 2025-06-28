/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect, useRef } from "react";
import { TouchableOpacity, View } from "react-native";

type AddAnotherWalletScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.ADD_ANOTHER_WALLET_SCREEN
>;

const AddAnotherWalletScreen: React.FC<AddAnotherWalletScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <CustomHeaderButton
          position="right"
          onPress={() => bottomSheetModalRef.current?.present()}
        />
      ),
    });
  }, [navigation]);

  const handleCreateAccount = () => {
    navigation.navigate(MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN);
  };

  const handleImportSecretKey = () => {
    navigation.navigate(MANAGE_WALLETS_ROUTES.IMPORT_SECRET_KEY_SCREEN);
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <BottomSheet
        title={t("addAnotherWalletScreen.helperBottomSheet.title")}
        description={t("addAnotherWalletScreen.helperBottomSheet.description")}
        modalRef={bottomSheetModalRef}
        handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
      />
      <View>
        <TouchableOpacity
          className="bg-background-tertiary rounded-2xl p-5"
          onPress={handleCreateAccount}
        >
          <Icon.PlusCircle themeColor="lime" size={20} withBackground />
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
          <Icon.Download01 themeColor="pink" size={20} withBackground />
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
