/* eslint-disable @typescript-eslint/no-misused-promises */
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Modal from "components/Modal";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { formatTokenIdentifier } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useTokenActions } from "hooks/useTokenActions";
import React, { useState } from "react";
import { Platform, View } from "react-native";

const icons = Platform.select({
  ios: {
    copyAddress: "doc.on.doc",
    removeToken: "minus.circle",
  },
  android: {
    copyAddress: "baseline_format_paint",
    removeToken: "outline_circle",
  },
});

type ManageTokenRightContentProps = {
  token: {
    isNative: boolean;
    id: string;
  };
  handleRemoveToken: (onComplete: () => void) => void;
  isRemovingToken: boolean;
};

const ManageTokenRightContent: React.FC<ManageTokenRightContentProps> = ({
  token,
  handleRemoveToken,
  isRemovingToken,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyTokenAddress } = useTokenActions();
  const { tokenCode } = formatTokenIdentifier(token.id);

  const showRemoveTokenAlert = () => {
    setModalVisible(true);
  };

  const handleRemoveTokenClick = () => {
    handleRemoveToken(() => setModalVisible(false));
    // The modal will be closed by the callback when removal is complete
    // No need to set modalVisible to false immediately
  };

  const menuActions: MenuItem[] = [
    {
      actions: [
        {
          title: t("manageTokenRightContent.copyAddress"),
          systemIcon: icons!.copyAddress,
          onPress: () =>
            copyTokenAddress(
              token.id,
              "manageTokenRightContent.tokenAddressCopied",
            ),
        },
      ],
    },
    {
      title: t("common.remove"),
      systemIcon: icons!.removeToken,
      onPress: () => showRemoveTokenAlert(),
      destructive: true,
      disabled: token.isNative,
    },
  ];

  return (
    <ContextMenuButton
      contextMenuProps={{
        actions: menuActions,
      }}
    >
      <Icon.DotsHorizontal color={themeColors.foreground.primary} />
      <Modal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <Text xl regular>
          {t("manageTokenRightContent.removeTokenModal.title", {
            tokenCode,
          })}
        </Text>
        <View className="h-2" />
        <Text md regular secondary>
          {t("manageTokenRightContent.removeTokenModal.message")}
        </Text>
        <View className="h-8" />
        <View className="flex-row justify-between w-full gap-3">
          <View className="flex-1">
            <Button
              secondary
              lg
              isFullWidth
              onPress={() => setModalVisible(false)}
              disabled={isRemovingToken}
            >
              {t("common.cancel")}
            </Button>
          </View>
          <View className="flex-1">
            <Button
              lg
              destructive
              isFullWidth
              onPress={handleRemoveTokenClick}
              isLoading={isRemovingToken}
            >
              {t("common.remove")}
            </Button>
          </View>
        </View>
      </Modal>
    </ContextMenuButton>
  );
};

export default ManageTokenRightContent;
