import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BalancesList } from "components/BalancesList";
import { IconButton } from "components/IconButton";
import { BaseLayout } from "components/layout/BaseLayout";
import ManageAccounts from "components/screens/HomeScreen/ManageAccounts";
import WelcomeBannerBottomSheet from "components/screens/HomeScreen/WelcomeBannerBottomSheet";
import { ConnectedAppsBottomSheet } from "components/screens/WalletKit/ConnectedAppsBottomSheet";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import {
  MainTabStackParamList,
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  BUY_XLM_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useHomeHeaders } from "hooks/useHomeHeaders";
import { useTotalBalance } from "hooks/useTotalBalance";
import { useWelcomeBanner } from "hooks/useWelcomeBanner";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Dimensions, TouchableOpacity, View } from "react-native";

const { width } = Dimensions.get("window");

/**
 * Top section of the home screen containing account info and actions
 */
type HomeScreenProps = BottomTabScreenProps<
  MainTabStackParamList & RootStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HOME
>;

/**
 * Home screen component displaying account information and balances
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { account } = useGetActiveAccount();
  const { network, getAllAccounts, allAccounts } = useAuthenticationStore();
  const { themeColors } = useColors();
  const connectedAppsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const manageAccountsBottomSheetRef = useRef<BottomSheetModal>(null);

  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  const { formattedBalance, rawBalance } = useTotalBalance();
  const { balances, isFunded } = useBalancesStore();

  const hasAssets = useMemo(() => Object.keys(balances).length > 0, [balances]);
  const hasZeroBalance = useMemo(
    () => rawBalance?.isLessThanOrEqualTo(0) ?? true,
    [rawBalance],
  );

  useHomeHeaders({
    navigation,
    hasAssets,
    connectedAppsBottomSheetModalRef,
  });

  const { welcomeBannerBottomSheetModalRef, handleWelcomeBannerDismiss } =
    useWelcomeBanner({
      account,
      isFunded,
    });

  useEffect(() => {
    const fetchAccounts = async () => {
      await getAllAccounts();
    };

    fetchAccounts();
  }, [getAllAccounts]);

  const navigateToBuyXLM = useCallback(() => {
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
      screen: BUY_XLM_ROUTES.BUY_XLM_SCREEN,
      params: { isUnfunded: !isFunded },
    });
  }, [navigation, isFunded]);

  const handleCopyAddress = (publicKey?: string) => {
    if (!publicKey) return;

    copyToClipboard(publicKey, {
      notificationMessage: t("accountAddressCopied"),
    });
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
    <BaseLayout insets={{ bottom: false, top: false }}>
      <WelcomeBannerBottomSheet
        modalRef={welcomeBannerBottomSheetModalRef}
        onAddXLM={navigateToBuyXLM}
        onDismiss={() => {
          handleWelcomeBannerDismiss();
        }}
      />
      <ConnectedAppsBottomSheet
        modalRef={connectedAppsBottomSheetModalRef}
        onDismiss={() => connectedAppsBottomSheetModalRef.current?.dismiss()}
      />
      <ManageAccounts
        navigation={navigation}
        accounts={allAccounts}
        activeAccount={account}
        bottomSheetRef={manageAccountsBottomSheetRef}
      />

      <View className="pt-8 w-full items-center">
        <View className="flex-col gap-3 items-center">
          <TouchableOpacity
            onPress={() => manageAccountsBottomSheetRef.current?.present()}
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
        </View>

        <View className="flex-row gap-6 items-center justify-center my-8">
          <IconButton
            Icon={Icon.Plus}
            title={t("home.buy")}
            onPress={navigateToBuyXLM}
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
        </View>
      </View>

      <View
        className="border-b mb-6 -ml-7 border-border-primary"
        style={{ width }}
      />

      <BalancesList
        publicKey={account?.publicKey ?? ""}
        network={network}
        onTokenPress={handleTokenPress}
      />
    </BaseLayout>
  );
};

export default HomeScreen;
