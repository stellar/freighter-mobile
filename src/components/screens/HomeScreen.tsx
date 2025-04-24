import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BalancesList } from "components/BalancesList";
import BottomSheet from "components/BottomSheet";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import { IconButton } from "components/IconButton";
import Modal from "components/Modal";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { logger } from "config/logger";
import {
  MainTabStackParamList,
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { THEME } from "config/theme";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { px } from "helpers/dimensions";
import { truncatePublicKey } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTotalBalance } from "hooks/useTotalBalance";
import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
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

const AccountItemRow: React.FC<{
  account: ActiveAccount | null;
  handleCopyAddress: (publicKey: string) => void;
  handleRenameAccount: () => void;
}> = ({ account, handleCopyAddress, handleRenameAccount }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  if (!account) return null;

  const truncatedPublicKey = truncatePublicKey({
    publicKey: account.publicKey,
    length: 5,
  });

  const icons = Platform.select({
    ios: {
      renameWallet: "pencil",
      copyAddress: "doc.on.doc",
    },
    android: {
      renameWallet: "baseline_edit",
      copyAddress: "copy",
    },
  });

  const actions: MenuItem[] = [
    {
      title: t("home.manageAccount.renameWallet"),
      systemIcon: icons!.renameWallet,
      onPress: handleRenameAccount,
    },
    {
      title: t("home.manageAccount.copyAddress"),
      systemIcon: icons!.copyAddress,
      onPress: () => handleCopyAddress(account.publicKey),
    },
  ];

  return (
    <View className="mb-4 mt-8 flex-row justify-between items-center flex-1">
      <View className="flex-row items-center flex-1">
        <Avatar size="md" publicAddress={account.publicKey} isSelected />
        <View className="ml-4 flex-1 mr-2">
          <Text md primary medium numberOfLines={1}>
            {account.accountName}
          </Text>
          <Text sm secondary medium numberOfLines={1}>
            {truncatedPublicKey}
          </Text>
        </View>
      </View>
      <ContextMenuButton contextMenuProps={{ actions }}>
        <Icon.DotsHorizontal size={24} color={themeColors.foreground.primary} />
      </ContextMenuButton>
    </View>
  );
};
const ManageAccountBottomSheet: React.FC<{
  handleCloseModal: () => void;
  onPressAddAnotherWallet: () => void;
  handleCopyAddress: (publicKey: string) => void;
  handleRenameAccount: () => void;
}> = ({
  handleCloseModal,
  onPressAddAnotherWallet,
  handleCopyAddress,
  handleRenameAccount,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();

  return (
    <View className="flex-1 justify-between items-center">
      <View className="flex-row items-center justify-between w-full">
        <TouchableOpacity onPress={handleCloseModal}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
        <Text md primary semiBold>
          {t("home.manageAccount.title")}
        </Text>
        <TouchableOpacity onPress={onPressAddAnotherWallet}>
          <Icon.PlusCircle size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      </View>
      <ScrollView
        className="w-full flex-1"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <AccountItemRow
          account={account}
          handleCopyAddress={handleCopyAddress}
          handleRenameAccount={handleRenameAccount}
        />
      </ScrollView>
      <Button tertiary isFullWidth lg onPress={onPressAddAnotherWallet}>
        {t("home.manageAccount.addWallet")}
      </Button>
    </View>
  );
};

/**
 * Home screen component displaying account information and balances
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { themeColors } = useColors();
  const [modalVisible, setModalVisible] = useState(false);
  const manageAccountBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  const { formattedBalance } = useTotalBalance();
  const balances = useBalancesStore((state) => state.balances);

  const hasAssets = useMemo(() => Object.keys(balances).length > 0, [balances]);

  const actions = [
    {
      title: t("home.actions.settings"),
      systemIcon: Platform.select({
        ios: "gear",
        android: "baseline_settings",
      }),
      onPress: () => navigation.navigate(ROOT_NAVIGATOR_ROUTES.SETTINGS_STACK),
    },
    ...(hasAssets
      ? [
          {
            title: t("home.actions.manageAssets"),
            systemIcon: Platform.select({
              ios: "pencil",
              android: "baseline_delete",
            }),
            onPress: () =>
              navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_ASSETS_STACK),
          },
        ]
      : []),
    {
      title: t("home.actions.myQRCode"),
      systemIcon: Platform.select({
        ios: "qrcode",
        android: "outline_circle",
      }),
      onPress: () => {}, // TODO: Implement QR code functionality
      disabled: true,
    },
  ];

  const handleCopyAddress = (publicKey?: string) => {
    if (!publicKey) return;

    copyToClipboard(publicKey, {
      notificationMessage: t("accountAddressCopied"),
    });
  };

  const handleAddAnotherWallet = () => {
    manageAccountBottomSheetModalRef.current?.dismiss();
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_WALLETS_STACK);
  };

  const handleRenameAccount = (text: string) => {
    logger.debug("text", text);
  };

  return (
    <BaseLayout insets={{ bottom: false }}>
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        closeOnOverlayPress
      >
        <View className="justify-center items-center">
          <Avatar size="md" publicAddress={account?.publicKey ?? ""} />
          <View className="h-4" />
          <Text primary md medium>
            {truncatePublicKey({ publicKey: account?.publicKey ?? "" })}
          </Text>
          <Text secondary sm regular>
            {t("renameAccountModal.currentName")}
          </Text>
          <View className="h-8" />
        </View>
        <View>
          <Input
            placeholder={t("renameAccountModal.nameInputPlaceholder")}
            fieldSize="lg"
            leftElement={
              <Icon.UserCircle
                size={16}
                color={themeColors.foreground.primary}
              />
            }
            autoCapitalize="none"
            value={account?.accountName}
            onChangeText={handleRenameAccount}
          />
        </View>
        <View className="h-4" />
        <View className="flex-row justify-between w-full gap-3">
          <View className="flex-1">
            <Button
              secondary
              lg
              isFullWidth
              onPress={() => setModalVisible(false)}
            >
              {t("renameAccountModal.skip")}
            </Button>
          </View>
          <View className="flex-1">
            <Button lg tertiary isFullWidth>
              {t("renameAccountModal.saveName")}
            </Button>
          </View>
        </View>
      </Modal>
      <BottomSheet
        snapPoints={["80%"]}
        modalRef={manageAccountBottomSheetModalRef}
        handleCloseModal={() =>
          manageAccountBottomSheetModalRef.current?.dismiss()
        }
        bottomSheetModalProps={{
          enablePanDownToClose: false,
        }}
        customContent={
          <ManageAccountBottomSheet
            handleCloseModal={() =>
              manageAccountBottomSheetModalRef.current?.dismiss()
            }
            onPressAddAnotherWallet={handleAddAnotherWallet}
            handleCopyAddress={handleCopyAddress}
            handleRenameAccount={() => setModalVisible(true)}
          />
        }
      />
      <HeaderContainer>
        <ContextMenuButton
          contextMenuProps={{
            actions,
          }}
        >
          <Icon.DotsHorizontal size={24} color={themeColors.base[1]} />
        </ContextMenuButton>
      </HeaderContainer>

      <TopSection>
        <AccountTotal>
          <TouchableOpacity
            onPress={() => manageAccountBottomSheetModalRef.current?.present()}
          >
            <View className="flex-row items-center gap-2">
              <Avatar size="sm" publicAddress={account?.publicKey ?? ""} />
              <Text>{account?.accountName ?? t("home.title")}</Text>
              <Icon.ChevronDown
                size={16}
                color={themeColors.foreground.primary}
              />
            </View>
          </TouchableOpacity>
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
            onPress={() => handleCopyAddress(account?.publicKey)}
          />
        </ButtonsRow>
      </TopSection>

      <BorderLine />

      <BalancesList publicKey={account?.publicKey ?? ""} network={network} />
    </BaseLayout>
  );
};
