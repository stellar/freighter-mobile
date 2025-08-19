import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { IconButton } from "components/IconButton";
import { TokensCollectiblesTabs } from "components/TokensCollectiblesTabs";
import { AnalyticsDebugBottomSheet } from "components/analytics/AnalyticsDebugBottomSheet";
import { AnalyticsDebugTrigger } from "components/analytics/AnalyticsDebugTrigger";
import { BaseLayout } from "components/layout/BaseLayout";
import ManageAccounts from "components/screens/HomeScreen/ManageAccounts";
import WelcomeBannerBottomSheet from "components/screens/HomeScreen/WelcomeBannerBottomSheet";
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
  SEND_PAYMENT_ROUTES,
  SWAP_ROUTES,
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
import { TouchableOpacity, View } from "react-native";
import { analytics } from "services/analytics";

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
export const HomeScreen: React.FC<HomeScreenProps> = React.memo(
  ({ navigation }) => {
    const { account } = useGetActiveAccount();
    const { network, getAllAccounts, allAccounts } = useAuthenticationStore();
    const { themeColors } = useColors();
    const manageAccountsBottomSheetRef = useRef<BottomSheetModal>(null);
    const analyticsDebugBottomSheetRef = useRef<BottomSheetModal>(null);

    const { t } = useAppTranslation();
    const { copyToClipboard } = useClipboard();

    const { formattedBalance, rawBalance } = useTotalBalance();
    const {
      balances,
      isFunded,
      isLoading: isLoadingBalances,
    } = useBalancesStore();

    const hasTokens = useMemo(
      () => Object.keys(balances).length > 0,
      [balances],
    );
    const hasZeroBalance = useMemo(
      () => rawBalance?.isLessThanOrEqualTo(0) ?? true,
      [rawBalance],
    );

    // Set up navigation headers (hook handles navigation.setOptions internally)
    useHomeHeaders({ navigation });

    const { welcomeBannerBottomSheetModalRef, handleWelcomeBannerDismiss } =
      useWelcomeBanner({
        account,
        isFunded,
        isLoadingBalances,
      });

    // NOTE: VIEW_HOME analytics event is already tracked by useNavigationAnalytics
    // when the user navigates to this screen. No need for additional tracking here.

    useEffect(() => {
      const fetchAccounts = async () => {
        await getAllAccounts();
      };

      fetchAccounts();
    }, [getAllAccounts]);

    const navigateToBuyXLM = useCallback(() => {
      // Navigation analytics already tracked by useNavigationAnalytics
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
        screen: BUY_XLM_ROUTES.BUY_XLM_SCREEN,
        params: { isUnfunded: !isFunded },
      });
    }, [navigation, isFunded]);

    const handleCopyAddress = useCallback(
      (publicKey?: string) => {
        if (!publicKey) return;

        analytics.trackCopyPublicKey();

        copyToClipboard(publicKey, {
          notificationMessage: t("accountAddressCopied"),
        });
      },
      [copyToClipboard, t],
    );

    const handleTokenPress = useCallback(
      (tokenId: string) => {
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
      },
      [navigation],
    );

    const handleCollectiblePress = useCallback(
      ({
        collectionAddress,
        tokenId,
      }: {
        collectionAddress: string;
        tokenId: string;
      }) => {
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.COLLECTIBLE_DETAILS_SCREEN, {
          collectionAddress,
          tokenId,
        });
      },
      [navigation],
    );

    const handleSendPress = useCallback(() => {
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK, {
        screen: SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN,
        params: { tokenId: undefined },
      });
    }, [navigation]);

    const handleSwapPress = useCallback(() => {
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.SWAP_STACK, {
        screen: SWAP_ROUTES.SWAP_SCREEN,
      });
    }, [navigation]);

    const handleManageAccountsPress = useCallback(() => {
      manageAccountsBottomSheetRef.current?.present();
    }, []);

    const handleAnalyticsDebugPress = useCallback(() => {
      analyticsDebugBottomSheetRef.current?.present();
    }, []);

    const handleAnalyticsDebugDismiss = useCallback(() => {
      analyticsDebugBottomSheetRef.current?.dismiss();
    }, []);

    return (
      <BaseLayout
        insets={{ bottom: false, top: false, left: false, right: false }}
      >
        <WelcomeBannerBottomSheet
          modalRef={welcomeBannerBottomSheetModalRef}
          onAddXLM={navigateToBuyXLM}
          onDismiss={handleWelcomeBannerDismiss}
        />
        <ManageAccounts
          navigation={navigation}
          accounts={allAccounts}
          activeAccount={account}
          bottomSheetRef={manageAccountsBottomSheetRef}
        />

        <View className="pt-8 w-full items-center">
          <View className="flex-col gap-3 items-center">
            <TouchableOpacity onPress={handleManageAccountsPress}>
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
              onPress={handleSendPress}
            />
            <IconButton
              Icon={Icon.RefreshCw02}
              title={t("home.swap")}
              disabled={hasZeroBalance}
              onPress={handleSwapPress}
            />
            <IconButton
              Icon={Icon.Copy01}
              title={t("home.copy")}
              onPress={() => handleCopyAddress(account?.publicKey)}
            />
          </View>
        </View>

        <View className="w-full border-b mb-4 border-border-primary" />

        <TokensCollectiblesTabs
          showTokensSettings={hasTokens}
          publicKey={account?.publicKey ?? ""}
          network={network}
          onTokenPress={handleTokenPress}
          onCollectiblePress={handleCollectiblePress}
        />

        {/* Analytics Debug - Development Only */}
        <AnalyticsDebugBottomSheet
          modalRef={analyticsDebugBottomSheetRef}
          onDismiss={handleAnalyticsDebugDismiss}
        />
        <AnalyticsDebugTrigger onPress={handleAnalyticsDebugPress} />
      </BaseLayout>
    );
  },
);

HomeScreen.displayName = "HomeScreen";

export default HomeScreen;
