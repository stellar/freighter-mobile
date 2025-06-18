import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BalancesList } from "components/BalancesList";
import BottomSheet from "components/BottomSheet";
import ContextMenuButton from "components/ContextMenuButton";
import { IconButton } from "components/IconButton";
import { BaseLayout } from "components/layout/BaseLayout";
import ManageAccountBottomSheet from "components/screens/HomeScreen/ManageAccountBottomSheet";
import RenameAccountModal from "components/screens/HomeScreen/RenameAccountModal";
import WelcomeBannerBottomSheet from "components/screens/HomeScreen/WelcomeBannerBottomSheet";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_PADDING, NATIVE_TOKEN_CODE } from "config/constants";
import { logger } from "config/logger";
import {
  MainTabStackParamList,
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  BUY_XLM_ROUTES,
} from "config/routes";
import { THEME } from "config/theme";
import { Account } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { px } from "helpers/dimensions";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTotalBalance } from "hooks/useTotalBalance";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dimensions, Platform, TouchableOpacity, View } from "react-native";
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

/**
 * Home screen component displaying account information and balances
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { account } = useGetActiveAccount();
  const {
    network,
    getAllAccounts,
    renameAccount,
    selectAccount,
    allAccounts,
    isRenamingAccount,
  } = useAuthenticationStore();
  const { themeColors } = useColors();
  const [accountToRename, setAccountToRename] = useState<Account | null>(null);
  const [renameAccountModalVisible, setRenameAccountModalVisible] =
    useState(false);
  const manageAccountBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const welcomeBannerBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [bannerPresented, setBannerPresented] = useState(false);

  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  const { formattedBalance, rawBalance } = useTotalBalance();
  const balances = useBalancesStore((state) => state.balances);

  const hasAssets = useMemo(() => Object.keys(balances).length > 0, [balances]);
  const hasZeroBalance = useMemo(
    () => rawBalance?.isLessThanOrEqualTo(0) ?? true,
    [rawBalance],
  );

  const mainWalletPublicKey =
    Array.isArray(allAccounts) && allAccounts.length > 0
      ? allAccounts[0].publicKey
      : undefined;

  useEffect(() => {
    const fetchAccounts = async () => {
      await getAllAccounts();
    };

    fetchAccounts();
  }, [getAllAccounts]);

  // Check if welcome modal should be shown for new accounts
  const checkWelcomeBannerStatus = useCallback(async () => {
    if (!mainWalletPublicKey) {
      return;
    }

    try {
      const hasSeenWelcome = await AsyncStorage.getItem(
        `welcomeBanner_shown_${mainWalletPublicKey}`,
      );
      if (hasSeenWelcome) {
        // If already seen, mark as presented to prevent future checks
        setBannerPresented(true);
        return;
      }

      if (!bannerPresented) {
        // Set banner as presented immediately to prevent multiple presentations
        setBannerPresented(true);
        welcomeBannerBottomSheetModalRef.current?.present();
      }
    } catch (error) {
      logger.error("Error checking welcome banner status:", String(error));
    }
  }, [mainWalletPublicKey, bannerPresented]);

  useEffect(() => {
    checkWelcomeBannerStatus();
  }, [checkWelcomeBannerStatus]);

  const handleWelcomeBannerDismiss = async () => {
    try {
      if (mainWalletPublicKey) {
        await AsyncStorage.setItem(
          `welcomeBanner_shown_${mainWalletPublicKey}`,
          "true",
        );
      }
    } catch (error) {
      logger.error("Error saving welcome banner status:", String(error));
    }
    welcomeBannerBottomSheetModalRef.current?.dismiss();
  };

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
      onPress: () =>
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN, {
          showNavigationAsCloseButton: true,
        }),
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

  const handleRenameAccount = async (newAccountName: string) => {
    if (!accountToRename || !account) return;

    await renameAccount({
      accountName: newAccountName,
      publicKey: accountToRename.publicKey,
    });
    setRenameAccountModalVisible(false);
  };

  const handleSelectAccount = async (publicKey: string) => {
    if (publicKey === account?.publicKey) {
      return;
    }

    await selectAccount(publicKey);
    manageAccountBottomSheetModalRef.current?.dismiss();
  };

  const handleOpenRenameAccountModal = (selectedAccount: Account) => {
    setAccountToRename(selectedAccount);

    setRenameAccountModalVisible(true);
  };

  const handleTokenPress = (tokenId: string) => {
    let tokenSymbol: string;

    if (tokenId === "native") {
      tokenSymbol = NATIVE_TOKEN_CODE;
    } else if (isContractId(tokenId)) {
      // For Soroban contracts, pass the contract ID as symbol initially
      // The TokenDetailsScreen will handle fetching the actual symbol
      tokenSymbol = tokenId;
    } else {
      // Classic asset format: CODE:ISSUER
      [tokenSymbol] = tokenId.split(":");
    }

    navigation.navigate(ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN, {
      tokenId,
      tokenSymbol,
    });
  };

  return (
    <BaseLayout insets={{ bottom: false }}>
      <RenameAccountModal
        modalVisible={renameAccountModalVisible}
        setModalVisible={setRenameAccountModalVisible}
        handleRenameAccount={handleRenameAccount}
        account={accountToRename!}
        isRenamingAccount={isRenamingAccount}
      />
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
            handleRenameAccount={handleOpenRenameAccountModal}
            accounts={allAccounts}
            activeAccount={account}
            handleSelectAccount={handleSelectAccount}
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
          <IconButton
            Icon={Icon.Plus}
            title={t("home.buy")}
            onPress={() =>
              navigation.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
                screen: BUY_XLM_ROUTES.BUY_XLM_SCREEN,
                params: { isUnfunded: hasZeroBalance },
              })
            }
          />
          <IconButton
            Icon={Icon.ArrowUp}
            title={t("home.send")}
            disabled={hasZeroBalance}
            onPress={() =>
              navigation.navigate(ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK)
            }
          />
          <IconButton
            Icon={Icon.RefreshCw02}
            title={t("home.swap")}
            disabled={hasZeroBalance}
            onPress={() =>
              navigation.navigate(ROOT_NAVIGATOR_ROUTES.SWAP_STACK)
            }
          />
          <IconButton
            Icon={Icon.Copy01}
            title={t("home.copy")}
            onPress={() => handleCopyAddress(account?.publicKey)}
          />
        </ButtonsRow>
      </TopSection>

      <BorderLine />

      <BalancesList
        publicKey={account?.publicKey ?? ""}
        network={network}
        onTokenPress={handleTokenPress}
      />

      <WelcomeBannerBottomSheet
        modalRef={welcomeBannerBottomSheetModalRef}
        onAddXLM={() => {
          navigation.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
            screen: BUY_XLM_ROUTES.BUY_XLM_SCREEN,
            params: { isUnfunded: hasZeroBalance },
          });
        }}
        onDismiss={() => {
          handleWelcomeBannerDismiss();
        }}
      />
    </BaseLayout>
  );
};

export default HomeScreen;
