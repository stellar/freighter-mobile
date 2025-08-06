/* eslint-disable @typescript-eslint/no-misused-promises */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { SimpleBalancesList } from "components/SimpleBalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageAssets } from "hooks/useManageAssets";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useRef } from "react";
import { View } from "react-native";

type ManageAssetsScreenProps = NativeStackScreenProps<
  ManageAssetsStackParamList,
  typeof MANAGE_ASSETS_ROUTES.MANAGE_ASSETS_SCREEN
>;

const ManageAssetsScreen: React.FC<ManageAssetsScreenProps> = ({
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

  const { removeAsset, isRemovingAsset } = useManageAssets({
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
          title={t("manageAssetsScreen.moreInfo.title")}
          description={`${t("manageAssetsScreen.moreInfo.block1")}\n\n${t("manageAssetsScreen.moreInfo.block2")}`}
          modalRef={bottomSheetModalRef}
          handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
        />
        <SimpleBalancesList
          publicKey={account?.publicKey ?? ""}
          network={network}
          handleRemoveAsset={removeAsset}
          isRemovingAsset={isRemovingAsset}
        />
        <View className="h-4" />
        <Button
          tertiary
          lg
          testID="default-action-button"
          onPress={() => {
            navigation.navigate(MANAGE_ASSETS_ROUTES.ADD_ASSET_SCREEN);
          }}
        >
          {t("manageAssetsScreen.addTokenButton")}
        </Button>
      </View>
    </BaseLayout>
  );
};
export default ManageAssetsScreen;
