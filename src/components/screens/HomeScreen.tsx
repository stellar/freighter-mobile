import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BalancesList } from "components/BalancesList";
import ContextMenuButton from "components/ContextMenuButton";
import { IconButton } from "components/IconButton";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { logger } from "config/logger";
import {
  MainTabStackParamList,
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { px, pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTotalBalance } from "hooks/useTotalBalance";
import React from "react";
import { Dimensions, Platform } from "react-native";
import styled from "styled-components/native";

const { width } = Dimensions.get("window");

type HomeScreenProps = BottomTabScreenProps<
  MainTabStackParamList & RootStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HOME
>;

const TopSection = styled.View`
  padding-top: ${px(22)};
  width: 100%;
  align-items: center;
`;

const AccountTotal = styled.View`
  flex-direction: column;
  gap: ${px(12)};
  align-items: center;
`;

const AccountNameRow = styled.View`
  flex-direction: row;
  gap: ${px(6)};
  align-items: center;
`;

const ButtonsRow = styled.View`
  flex-direction: row;
  gap: ${px(24)};
  align-items: center;
  justify-content: center;
  margin-vertical: ${px(32)};
`;

const BorderLine = styled.View`
  width: ${width}px;
  margin-left: ${px(-24)};
  border-bottom-width: ${px(1)};
  border-bottom-color: ${THEME.colors.border.default};
  margin-bottom: ${px(24)};
`;

const Icons = Platform.select({
  ios: {
    settings: "gear",
    manageAssets: "pencil",
    myQrCode: "qrcode",
  },
  android: {
    settings: "baseline_format_paint",
    manageAssets: "baseline_delete",
    myQrCode: "outline_circle",
  },
});

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const publicKey = account?.publicKey;

  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  const { formattedBalance } = useTotalBalance();

  const actions = [
    {
      title: t("home.actions.settings"),
      systemIcon: Icons!.settings,
      onPress: () => logger.debug("HomeScreen", "Not implemented"),
    },
    {
      title: t("home.actions.manageAssets"),
      systemIcon: Icons!.manageAssets,
      onPress: () =>
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_ASSETS_STACK),
    },
    {
      title: t("home.actions.myQRCode"),
      systemIcon: Icons!.myQrCode,
      onPress: () => logger.debug("HomeScreen", "Not implemented"),
    },
  ];

  const handleCopyAddress = () => {
    if (!publicKey) return;

    copyToClipboard(publicKey, {
      notificationMessage: t("accountAddressCopied"),
    });
  };

  return (
    <BaseLayout insets={{ bottom: false }}>
      <ContextMenuButton
        contextMenuProps={{
          onPress: (e) => {
            actions[e.nativeEvent.index].onPress();
          },
          actions,
          style: {
            alignSelf: "flex-start",
          },
        }}
      >
        <Icon.DotsHorizontal
          size={pxValue(24)}
          color={THEME.colors.base.secondary}
        />
      </ContextMenuButton>
      <TopSection>
        <AccountTotal>
          <AccountNameRow>
            <Avatar size="sm" publicAddress={publicKey ?? ""} />
            <Text>{account?.accountName ?? t("home.title")}</Text>
          </AccountNameRow>
          <Display lg medium>
            {formattedBalance}
          </Display>
        </AccountTotal>

        <ButtonsRow>
          <IconButton Icon={Icon.Plus} title={t("home.buy")} />
          <IconButton Icon={Icon.ArrowUp} title={t("home.send")} />
          <IconButton Icon={Icon.RefreshCw02} title={t("home.swap")} />
          <IconButton
            Icon={Icon.Copy01}
            title={t("home.copy")}
            onPress={handleCopyAddress}
          />
        </ButtonsRow>
      </TopSection>

      <BorderLine />

      <BalancesList publicKey={publicKey ?? ""} network={network} />
    </BaseLayout>
  );
};
