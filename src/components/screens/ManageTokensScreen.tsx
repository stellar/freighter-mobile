/* eslint-disable @typescript-eslint/no-misused-promises */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { SimpleBalancesList } from "components/SimpleBalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  MANAGE_TOKENS_ROUTES,
  ManageTokensStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageTokens } from "hooks/useManageTokens";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useRef } from "react";
import { TouchableOpacity, View } from "react-native";

type ManageTokensScreenProps = NativeStackScreenProps<
  ManageTokensStackParamList,
  typeof MANAGE_TOKENS_ROUTES.MANAGE_TOKENS_SCREEN
>;

const ManageTokensScreen: React.FC<ManageTokensScreenProps> = ({
  navigation,
}) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { handleRefresh } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const { removeToken } = useManageTokens({
    network,
    account,
    onSuccess: handleRefresh,
  });

  useRightHeaderButton({
    onPress: () => bottomSheetModalRef.current?.present(),
  });

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 justify-between pt-5">
        <BottomSheet
          title={t("manageTokensScreen.moreInfo.title")}
          description={`${t("manageTokensScreen.moreInfo.block1")}\n\n${t("manageTokensScreen.moreInfo.block2")}`}
          modalRef={bottomSheetModalRef}
          customContent={
            <View className="gap-4">
              <View className="flex-row justify-between items-center">
                <View className="size-10 rounded-lg items-center justify-center bg-lilac-3 border border-lilac-6">
                  <Icon.Coins01 themeColor="lilac" />
                </View>
                <TouchableOpacity
                  onPress={() => bottomSheetModalRef.current?.dismiss()}
                  className="size-10 items-center justify-center rounded-full bg-gray-3"
                >
                  <Icon.X color={themeColors.gray[9]} />
                </TouchableOpacity>
              </View>
              <View>
                <Text xl medium>
                  {t("manageTokensScreen.moreInfo.title")}
                </Text>
                <View className="h-4" />
                <Text md medium secondary>
                  {t("manageTokensScreen.moreInfo.block1")}
                </Text>
                <View className="h-4" />
                <Text md medium secondary>
                  {t("manageTokensScreen.moreInfo.block2")}
                </Text>
              </View>
            </View>
          }
          handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
        />
        <SimpleBalancesList
          publicKey={account?.publicKey ?? ""}
          network={network}
          handleRemoveToken={removeToken}
        />
        <View className="h-4" />
        <Button
          tertiary
          lg
          testID="default-action-button"
          onPress={() => {
            navigation.navigate(MANAGE_TOKENS_ROUTES.ADD_TOKEN_SCREEN);
          }}
        >
          {t("manageTokensScreen.addTokenButton")}
        </Button>
      </View>
    </BaseLayout>
  );
};
export default ManageTokensScreen;
