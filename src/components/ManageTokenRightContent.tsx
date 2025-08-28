/* eslint-disable @typescript-eslint/no-misused-promises */
import ConfirmationModal from "components/ConfirmationModal";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import { IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { formatTokenIdentifier } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import { useTokenActions } from "hooks/useTokenActions";
import React, { useState } from "react";
import { Platform } from "react-native";

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
  const { getBiometricButtonIcon } = useBiometrics();
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
      <ConfirmationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t("manageTokenRightContent.removeTokenModal.title", {
          tokenCode,
        })}
        message={t("manageTokenRightContent.removeTokenModal.message")}
        confirmText={t("common.remove")}
        cancelText={t("common.cancel")}
        onConfirm={handleRemoveTokenClick}
        confirmButtonIcon={getBiometricButtonIcon(themeColors.white)}
        confirmButtonIconPosition={IconPosition.LEFT}
        isLoading={isRemovingToken}
        destructive
      />
    </ContextMenuButton>
  );
};

export default ManageTokenRightContent;
