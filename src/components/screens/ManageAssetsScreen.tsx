/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import ContextMenuButton from "components/ContextMenuButton";
import { SimpleBalancesList } from "components/SimpleBalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { logger } from "config/logger";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { THEME } from "config/theme";
import { PricedBalance } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useAssetActions } from "hooks/useAssetActions";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useRef } from "react";
import { Platform, TouchableOpacity } from "react-native";
import styled from "styled-components/native";

type ManageAssetsScreenProps = NativeStackScreenProps<
  ManageAssetsStackParamList,
  typeof MANAGE_ASSETS_ROUTES.MANAGE_ASSETS_SCREEN
>;

const Spacer = styled.View`
  height: ${px(16)};
`;

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

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => bottomSheetModalRef.current?.present()}
        >
          <Icon.HelpCircle size={24} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const handleCopyTokenAddress = (balance: PricedBalance) => {
    copyAssetAddress(balance, "manageAssetsScreen.tokenAddressCopied");
  };

  const rightContent = (balance: PricedBalance) => {
    const menuActions = [
      {
        title: t("manageAssetsScreen.actions.copyAddress"),
        systemIcon: icons!.copyAddress,
        onPress: () => handleCopyTokenAddress(balance),
        disabled: true,
      },
      {
        title: t("manageAssetsScreen.actions.hideAsset"),
        systemIcon: icons!.hideAsset,
        onPress: () =>
          logger.debug("ManageAssetsScreen", "hideAsset Not implemented"),
        disabled: true,
      },
      {
        title: t("manageAssetsScreen.actions.removeAsset"),
        systemIcon: icons!.removeAsset,
        onPress: () =>
          logger.debug("ManageAssetsScreen", "removeAsset Not implemented"),
        destructive: true,
      },
    ];

    return (
      <ContextMenuButton
        contextMenuProps={{
          actions: menuActions,
        }}
      >
        <Icon.DotsHorizontal
          size={24}
          color={THEME.colors.foreground.primary}
        />
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
      />
      <Spacer />
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
