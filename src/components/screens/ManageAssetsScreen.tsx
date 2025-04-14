/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { SimpleBalancesList } from "components/SimpleBalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { logger } from "config/logger";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { ToastOptions, useToast } from "providers/ToastProvider";
import React, { useEffect, useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import {
  buildChangeTrustTx,
  signTransaction,
  submitTx,
} from "services/stellar";

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
  const { themeColors } = useColors();
  const { showToast } = useToast();
  const { handleRefresh } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });

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
  }, [navigation, t, themeColors]);

  const handleRemoveAsset = async (assetId: string) => {
    const assetCode = assetId.split(":")[0];

    let toastOptions: ToastOptions = {
      title: t("manageAssetsScreen.removeAssetSuccess", {
        assetName: assetCode,
      }),
      variant: "success",
    };

    try {
      const removeAssetTrustlineTx = await buildChangeTrustTx({
        assetIdentifier: assetId,
        network,
        publicKey: account?.publicKey ?? "",
        isRemove: true,
      });

      const signedTx = signTransaction({
        tx: removeAssetTrustlineTx,
        secretKey: account?.privateKey ?? "",
        network,
      });

      await submitTx({
        network,
        tx: signedTx,
      });
    } catch (error) {
      logger.error("ManageAssetsScreen", "Error removing asset", error);
      toastOptions = {
        title: t("manageAssetsScreen.removeAssetError", {
          assetName: assetCode,
        }),
        variant: "error",
      };
    } finally {
      handleRefresh();
      showToast(toastOptions);
    }
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <BottomSheet
        title={t("manageAssetsScreen.moreInfo.title")}
        description={`${t("manageAssetsScreen.moreInfo.block1")}\n\n${t("manageAssetsScreen.moreInfo.block2")}`}
        modalRef={bottomSheetModalRef}
        handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
      />
      <SimpleBalancesList
        publicKey={account?.publicKey ?? ""}
        network={network}
        handleRemoveAsset={handleRemoveAsset}
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
        {t("manageAssetsScreen.addAssetButton")}
      </Button>
    </BaseLayout>
  );
};
export default ManageAssetsScreen;
