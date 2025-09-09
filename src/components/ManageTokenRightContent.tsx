/* eslint-disable @typescript-eslint/no-misused-promises */
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useTokenActions } from "hooks/useTokenActions";
import React from "react";
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
  handleRemoveToken: () => void;
};

const ManageTokenRightContent: React.FC<ManageTokenRightContentProps> = ({
  token,
  handleRemoveToken,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyTokenAddress } = useTokenActions();

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
      onPress: handleRemoveToken,
      destructive: true,
    },
  ];

  return (
    <ContextMenuButton
      contextMenuProps={{
        actions: menuActions,
      }}
    >
      <Icon.DotsHorizontal color={themeColors.foreground.primary} />
    </ContextMenuButton>
  );
};

export default ManageTokenRightContent;
