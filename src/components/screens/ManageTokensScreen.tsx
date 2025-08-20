/* eslint-disable @typescript-eslint/no-misused-promises */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { SimpleBalancesList } from "components/SimpleBalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import {
  MANAGE_TOKENS_ROUTES,
  ManageTokensStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageTokens } from "hooks/useManageTokens";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useRef } from "react";
import { View } from "react-native";

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
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { handleRefresh } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const { removeToken, isRemovingToken } = useManageTokens({
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
          handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
        />
        <SimpleBalancesList
          publicKey={account?.publicKey ?? ""}
          network={network}
          handleRemoveToken={removeToken}
          isRemovingToken={isRemovingToken}
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
