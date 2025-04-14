/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import { SimpleBalancesList } from "components/SimpleBalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { logger } from "config/logger";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { PricedBalance } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useAssetActions } from "hooks/useAssetActions";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { ToastOptions, useToast } from "providers/ToastProvider";
import React, { useEffect, useRef } from "react";
import { Alert, Platform, TouchableOpacity, View } from "react-native";
import {
  buildChangeTrustTx,
  submitTx,
  signTransaction,
} from "services/stellar";

type ManageAssetsScreenProps = NativeStackScreenProps<
  ManageAssetsStackParamList,
  typeof MANAGE_ASSETS_ROUTES.MANAGE_ASSETS_SCREEN
>;

const icons = Platform.select({
  ios: {
    copyAddress: "doc.on.doc",
    hideAsset: "eye.slash",
    removeAsset: "minus.circle",
  },
  android: {
    copyAddress: "baseline_format_paint",
    hideAsset: "baseline_delete",
    removeAsset: "outline_circle",
  },
});

const ManageAssetsScreen: React.FC<ManageAssetsScreenProps> = ({
  navigation,
}) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const { copyAssetAddress } = useAssetActions();
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

  const handleCopyTokenAddress = (balance: PricedBalance) => {
    copyAssetAddress(balance, "manageAssetsScreen.tokenAddressCopied");
  };

  const handleRemoveAsset = async (balance: PricedBalance) => {
    let toastOptions: ToastOptions = {
      title: t("manageAssetsScreen.removeAssetSuccess", {
        assetName: balance.token.code,
      }),
      variant: "success",
    };

    try {
      const addAssetTrustlineTx = await buildChangeTrustTx({
        assetIdentifier: balance.id ?? "",
        network,
        publicKey: account?.publicKey ?? "",
        isRemove: true,
      });

      const signedTx = signTransaction({
        tx: addAssetTrustlineTx,
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
          assetName: balance.token.code,
        }),
        variant: "error",
      };
    } finally {
      handleRefresh();
      showToast(toastOptions);
    }
  };

  const showRemoveAssetAlert = (balance: PricedBalance) => {
    Alert.alert(
      t("manageAssetsScreen.removeAssetAlert.title"),
      t("manageAssetsScreen.removeAssetAlert.message"),
      [
        {
          text: t("manageAssetsScreen.removeAssetAlert.cancel"),
          style: "cancel",
        },
        {
          text: t("manageAssetsScreen.removeAssetAlert.remove"),
          onPress: () => handleRemoveAsset(balance),
          style: "destructive",
        },
      ],
    );
  };

  const rightContent = (balance: PricedBalance) => {
    const menuActions: MenuItem[] = [
      {
        actions: [
          {
            title: t("manageAssetsScreen.actions.copyAddress"),
            systemIcon: icons!.copyAddress,
            onPress: () => handleCopyTokenAddress(balance),
          },
          {
            title: t("manageAssetsScreen.actions.hideAsset"),
            systemIcon: icons!.hideAsset,
            onPress: () =>
              logger.debug("ManageAssetsScreen", "hideAsset Not implemented"),
            // TODO: Implement hide asset
            disabled: true,
          },
        ],
      },
      {
        title: t("manageAssetsScreen.actions.removeAsset"),
        systemIcon: icons!.removeAsset,
        onPress: () => showRemoveAssetAlert(balance),
        destructive: true,
      },
    ];

    return (
      <ContextMenuButton
        contextMenuProps={{
          actions: menuActions,
        }}
      >
        <Icon.DotsHorizontal size={24} color={themeColors.foreground.primary} />
      </ContextMenuButton>
    );
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
        renderRightContent={rightContent}
        hideNativeAsset
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
