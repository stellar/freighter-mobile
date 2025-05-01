/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
  const { themeColors } = useColors();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => bottomSheetModalRef.current?.present()}
        >
          <Icon.HelpCircle size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, themeColors]);

  const handleCreateAccount = () => {
    navigation.navigate(MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN);
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <BottomSheet
        title={t("addAnotherWalletScreen.helperBottomSheet.title")}
        description={t("addAnotherWalletScreen.helperBottomSheet.description")}
        modalRef={bottomSheetModalRef}
        handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
      />
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
    </BaseLayout>
  );
};

export default AddAnotherWalletScreen;
