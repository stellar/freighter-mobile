import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BalancesList } from "components/BalancesList";
import ContextMenuButton from "components/ContextMenuButton";
import { IconButton } from "components/IconButton";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import {
  MainTabStackParamList,
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTotalBalance } from "hooks/useTotalBalance";
import React from "react";
import { Dimensions, Platform } from "react-native";
import styled from "styled-components/native";

const { width } = Dimensions.get("window");

/**
 * Top section of the home screen containing account info and actions
 */
type HomeScreenProps = BottomTabScreenProps<
  MainTabStackParamList & RootStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HOME
>;

/**
 * Header container for the home screen menu
 */
const HeaderContainer = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${DEFAULT_PADDING}px;
`;

const TopSection = styled.View`
  padding-top: ${px(22)};
  width: 100%;
  align-items: center;
`;

/**
 * Container for account total and name
 */
const AccountTotal = styled.View`
  flex-direction: column;
  gap: ${px(12)};
  align-items: center;
`;

/**
 * Row containing account name and avatar
 */
const AccountNameRow = styled.View`
  flex-direction: row;
  gap: ${px(6)};
  align-items: center;
`;

/**
 * Row containing action buttons
 */
const ButtonsRow = styled.View`
  flex-direction: row;
  gap: ${px(24)};
  align-items: center;
  justify-content: center;
  margin-vertical: ${px(32)};
`;

/**
 * Divider line between sections
 */
const BorderLine = styled.View`
  width: ${width}px;
  margin-left: ${px(-24)};
  border-bottom-width: ${px(1)};
  border-bottom-color: ${THEME.colors.border.default};
  margin-bottom: ${px(24)};
`;

/**
 * Home screen component displaying account information and balances
 */
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
      systemIcon: Platform.select({
        ios: "gear",
        android: "baseline_settings",
      }),
      onPress: () => navigation.navigate(ROOT_NAVIGATOR_ROUTES.SETTINGS_STACK),
    },
    {
      title: t("home.actions.manageAssets"),
      systemIcon: Platform.select({
        ios: "pencil",
        android: "baseline_delete",
      }),
      onPress: () =>
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_ASSETS_STACK),
    },
    {
      title: t("home.actions.myQRCode"),
      systemIcon: Platform.select({
        ios: "qrcode",
        android: "outline_circle",
      }),
      onPress: () => {}, // TODO: Implement QR code functionality
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
      <HeaderContainer>
        <ContextMenuButton
          contextMenuProps={{
            actions,
          }}
        >
          <Icon.DotsHorizontal size={24} color={THEME.colors.base.secondary} />
        </ContextMenuButton>
      </HeaderContainer>

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
