/* eslint-disable @typescript-eslint/no-misused-promises */
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Modal from "components/Modal";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { formatAssetIdentifier } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import { useAssetActions } from "hooks/useAssetActions";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { Platform, View } from "react-native";

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
  handleRemoveAsset: (onComplete: () => void) => void;
  isRemovingAsset: boolean;
};

const ManageAssetRightContent: React.FC<ManageAssetRightContentProps> = ({
  asset,
  handleRemoveAsset,
  isRemovingAsset,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyAssetAddress } = useAssetActions();
  const { assetCode } = formatAssetIdentifier(asset.id);

  const showRemoveAssetAlert = () => {
    setModalVisible(true);
  };

  const handleRemoveAssetClick = () => {
    handleRemoveAsset(() => setModalVisible(false));
    // The modal will be closed by the callback when removal is complete
    // No need to set modalVisible to false immediately
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
      <Modal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <Text xl regular>
          {t("manageAssetRightContent.removeAssetModal.title", {
            assetCode,
          })}
        </Text>
        <View className="h-2" />
        <Text md regular secondary>
          {t("manageAssetRightContent.removeAssetModal.message")}
        </Text>
        <View className="h-8" />
        <View className="flex-row justify-between w-full gap-3">
          <View className="flex-1">
            <Button
              secondary
              lg
              isFullWidth
              onPress={() => setModalVisible(false)}
              disabled={isRemovingAsset}
            >
              {t("manageAssetRightContent.removeAssetModal.cancel")}
            </Button>
          </View>
          <View className="flex-1">
            <Button
              lg
              destructive
              isFullWidth
              onPress={handleRemoveAssetClick}
              isLoading={isRemovingAsset}
            >
              {t("manageAssetRightContent.removeAssetModal.remove")}
            </Button>
          </View>
        </View>
      </Modal>
    </ContextMenuButton>
  );
};

export default ManageAssetRightContent;
