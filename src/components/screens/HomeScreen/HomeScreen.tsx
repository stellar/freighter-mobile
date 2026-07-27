import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { HomeActionButton } from "components/HomeActionButton";
import { TokensCollectiblesTabs } from "components/TokensCollectiblesTabs";
import {
  WalletConnectE2EHelper,
  WalletConnectE2EHelperTrigger,
  WalletConnectE2EHelperRef,
} from "components/WalletConnectE2EHelper";
import { DebugBottomSheet } from "components/analytics/DebugBottomSheet";
import { DebugTrigger } from "components/debug/DebugTrigger";
import { BaseLayout } from "components/layout/BaseLayout";
import ManageAccounts from "components/screens/HomeScreen/ManageAccounts";
import WelcomeBannerBottomSheet from "components/screens/HomeScreen/WelcomeBannerBottomSheet";
import Icon from "components/sds/Icon";
import { Display } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import {
  MainTabStackParamList,
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  ADD_FUNDS_ROUTES,
  SEND_PAYMENT_ROUTES,
  SWAP_ROUTES,
} from "config/routes";
import { TokenTypeWithCustomToken } from "config/types";
import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useCollectiblesStore } from "ducks/collectibles";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useWalletKitStore } from "ducks/walletKit";
import { getTokenType } from "helpers/balances";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useHomeHeaders } from "hooks/useHomeHeaders";
import { useTotalBalance } from "hooks/useTotalBalance";
import { useWelcomeBanner } from "hooks/useWelcomeBanner";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, ScrollView, RefreshControl } from "react-native";

type HomeScreenProps = BottomTabScreenProps<
  MainTabStackParamList & RootStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HOME
>;

export const HomeScreen: React.FC<HomeScreenProps> = React.memo(
  ({ navigation }) => {
    const { account } = useGetActiveAccount();
    const {
      network,
      getAllAccounts,
      allAccounts,
      isSwitchingAccount,
      isLoadingAllAccounts,
    } = useAuthenticationStore();
    const { themeColors } = useColors();
    const manageAccountsBottomSheetRef = useRef<BottomSheetModal>(null);
    const debugBottomSheetRef = useRef<BottomSheetModal>(null);
    const walletConnectE2EHelperRef = useRef<WalletConnectE2EHelperRef>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const { t } = useAppTranslation();

    const { formattedBalance } = useTotalBalance();
    const {
      balances,
      isFunded,
      isLoading: isLoadingBalances,
      fetchAccountBalances,
    } = useBalancesStore();
    const { fetchCollectibles } = useCollectiblesStore();
    const { fetchActiveSessions } = useWalletKitStore();
    const { swap_enabled: swapEnabled } = useRemoteConfigStore();
    const fetchAccountsFiatTotals = useAccountsFiatTotalsStore(
      (state) => state.fetchAccountsFiatTotals,
    );

    const hasTokens = useMemo(
      () => Object.keys(balances).length > 0,
      [balances],
    );
    // Send/Swap require something to spend. Gate on actual holdings (any
    // non-zero token balance), not fiat value — fiat is unavailable on testnet
    // by design, so a fiat-based gate would wrongly disable a funded account.
    const hasZeroBalance = useMemo(
      () =>
        !Object.values(balances).some((balance) =>
          balance.total?.isGreaterThan(0),
        ),
      [balances],
    );

    const handleManageAccountsPress = useCallback(() => {
      manageAccountsBottomSheetRef.current?.present();
    }, []);

    // Set up navigation headers (hook handles navigation.setOptions
    // internally); the account switcher lives in the header now.
    useHomeHeaders({ navigation, onAccountPress: handleManageAccountsPress });

    const { welcomeBannerBottomSheetModalRef, handleWelcomeBannerDismiss } =
      useWelcomeBanner({
        account,
        isFunded,
        isLoadingBalances,
        isSwitchingAccount,
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
        screen: ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN,
        params: { isUnfunded: !isFunded },
      });
    }, [navigation, isFunded]);

    const handleTokenPress = useCallback(
      (tokenId: string) => {
        // Liquidity-pool rows don't have a useful TokenDetailsScreen layout
        // yet, so a tap from the Home list is a no-op. The row is still
        // displayed; we just don't navigate.
        if (
          getTokenType(tokenId) ===
          TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES
        ) {
          return;
        }

        let tokenSymbol: string;

        if (tokenId === "native") {
          tokenSymbol = NATIVE_TOKEN_CODE;
        } else if (isContractId(tokenId)) {
          // For Soroban contracts, pass the contract ID as symbol initially
          // The TokenDetailsScreen will handle fetching the actual symbol
          tokenSymbol = tokenId;
        } else {
          // Classic token format: CODE:ISSUER
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
        screen: SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN,
      });
    }, [navigation]);

    const handleSwapPress = useCallback(() => {
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.SWAP_STACK, {
        screen: SWAP_ROUTES.SWAP_AMOUNT_SCREEN,
        params: { tokenId: NATIVE_TOKEN_CODE, tokenSymbol: NATIVE_TOKEN_CODE },
      });
    }, [navigation]);

    const handleDebugPress = useCallback(() => {
      debugBottomSheetRef.current?.present();
    }, []);

    const handleDebugDismiss = useCallback(() => {
      debugBottomSheetRef.current?.dismiss();
    }, []);

    const handleWalletConnectE2EHelperPress = useCallback(() => {
      walletConnectE2EHelperRef.current?.present();
    }, []);

    const handleRefresh = useCallback(async () => {
      if (!account?.publicKey) return;

      // throw it out of the loop for instant state update
      setTimeout(() => setIsRefreshing(true));

      try {
        await Promise.all([
          fetchAccountBalances({
            publicKey: account.publicKey,
            network,
          }),
          fetchCollectibles({
            publicKey: account.publicKey,
            network,
          }),
          Promise.resolve(fetchActiveSessions(account.publicKey, network)),
          // Refresh the manage-accounts sheet's per-account USD totals too,
          // so a pull-to-refresh reflects transfers between own accounts.
          allAccounts.length > 0
            ? fetchAccountsFiatTotals({
                publicKeys: allAccounts.map(
                  (walletAccount) => walletAccount.publicKey,
                ),
                network,
                forceRefresh: true,
              })
            : Promise.resolve(),
        ]);
      } finally {
        setIsRefreshing(false);
      }
    }, [
      account?.publicKey,
      network,
      fetchAccountBalances,
      fetchCollectibles,
      fetchActiveSessions,
      fetchAccountsFiatTotals,
      allAccounts,
    ]);

    return (
      <BaseLayout
        testID="home-screen"
        insets={{ bottom: false, top: false, left: false, right: false }}
      >
        <WelcomeBannerBottomSheet
          modalRef={welcomeBannerBottomSheetModalRef}
          onAddXLM={navigateToBuyXLM}
          onDismiss={handleWelcomeBannerDismiss}
        />
        <ManageAccounts
          accounts={allAccounts}
          activeAccount={account}
          bottomSheetRef={manageAccountsBottomSheetRef}
          isLoadingAccounts={isLoadingAllAccounts}
        />

        <ScrollView
          testID="home-screen-scrollview"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                handleRefresh();
              }}
              tintColor={themeColors.secondary}
            />
          }
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View className="pt-[35px] w-full items-center">
            <Display lg medium>
              {formattedBalance}
            </Display>
          </View>

          <View className="flex-row gap-[12px] w-full px-6 py-6">
            <HomeActionButton
              Icon={Icon.Plus}
              title={t("home.buy")}
              onPress={navigateToBuyXLM}
              testID="icon-button-buy"
            />
            <HomeActionButton
              Icon={Icon.ArrowUp}
              title={t("home.send")}
              disabled={hasZeroBalance}
              onPress={handleSendPress}
              testID="icon-button-send"
            />
            {swapEnabled && (
              <HomeActionButton
                Icon={Icon.RefreshCw02}
                title={t("home.swap")}
                disabled={hasZeroBalance}
                onPress={handleSwapPress}
                testID="icon-button-swap"
              />
            )}
          </View>

          <TokensCollectiblesTabs
            // Should disable inner scrolling here since the whole Home screen is scrollable
            disableInnerScrolling
            showTokensSettings={hasTokens}
            publicKey={account?.publicKey ?? ""}
            network={network}
            onTokenPress={handleTokenPress}
            onCollectiblePress={handleCollectiblePress}
            balanceRowTestIDPrefix="home-token"
          />
        </ScrollView>

        {__DEV__ && (
          <DebugBottomSheet
            modalRef={debugBottomSheetRef}
            onDismiss={handleDebugDismiss}
          />
        )}
        <DebugTrigger onPress={handleDebugPress} />

        {/* WalletConnect E2E Helper - E2E Test Mode Only */}
        <WalletConnectE2EHelper ref={walletConnectE2EHelperRef} />
        <WalletConnectE2EHelperTrigger
          onPress={handleWalletConnectE2EHelperPress}
        />
      </BaseLayout>
    );
  },
);

HomeScreen.displayName = "HomeScreen";

export default HomeScreen;
