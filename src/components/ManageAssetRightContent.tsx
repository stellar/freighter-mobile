/* eslint-disable @typescript-eslint/no-misused-promises */
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Icon from "components/sds/Icon";
import { logger } from "config/logger";
import useAppTranslation from "hooks/useAppTranslation";
import { useAssetActions } from "hooks/useAssetActions";
import useColors from "hooks/useColors";
import React from "react";
import { Alert, Platform } from "react-native";

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

type ManageAssetRightContentProps = {
  asset: {
    isNative: boolean;
    id: string;
  };
  handleRemoveAsset: () => void;
};

const ManageAssetRightContent: React.FC<ManageAssetRightContentProps> = ({
  asset,
  handleRemoveAsset,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyAssetAddress } = useAssetActions();

  const showRemoveAssetAlert = () => {
    Alert.alert(
      t("manageAssetRightContent.removeAssetAlert.title"),
      t("manageAssetRightContent.removeAssetAlert.message"),
      [
        {
          text: t("manageAssetRightContent.removeAssetAlert.cancel"),
          style: "cancel",
        },
        {
          text: t("manageAssetRightContent.removeAssetAlert.remove"),
          onPress: () => handleRemoveAsset(),
          style: "destructive",
        },
      ],
    );
  };

  const menuActions: MenuItem[] = [
    {
      actions: [
        {
          title: t("manageAssetRightContent.copyAddress"),
          systemIcon: icons!.copyAddress,
          onPress: () =>
            copyAssetAddress(
              asset.id,
              "manageAssetRightContent.tokenAddressCopied",
            ),
        },
        {
          title: t("manageAssetRightContent.hideAsset"),
          systemIcon: icons!.hideAsset,
          onPress: () =>
            logger.debug(
              "manageAssetRightContent",
              "hideAsset Not implemented",
            ),
          // TODO: Implement hide asset
          disabled: true,
        },
      ],
    },
    {
      title: t("manageAssetRightContent.removeAsset"),
      systemIcon: icons!.removeAsset,
      onPress: () => showRemoveAssetAlert(),
      destructive: true,
      disabled: asset.isNative,
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

export default ManageAssetRightContent;
