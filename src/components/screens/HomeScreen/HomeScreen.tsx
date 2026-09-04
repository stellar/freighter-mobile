import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { FloatingTabActionButton } from "components/FloatingTabActionButton";
import { HomeActionButton } from "components/HomeActionButton";
import {
  TabType,
  TokensCollectiblesTabs,
} from "components/TokensCollectiblesTabs";
import {
  WalletConnectE2EHelper,
  WalletConnectE2EHelperTrigger,
  WalletConnectE2EHelperRef,
} from "components/WalletConnectE2EHelper";
import { DebugBottomSheet } from "components/analytics/DebugBottomSheet";
import { DebugTrigger } from "components/debug/DebugTrigger";
import { BaseLayout } from "components/layout/BaseLayout";
import ConnectedApps from "components/screens/HomeScreen/ConnectedApps";
import ManageAccounts from "components/screens/HomeScreen/ManageAccounts";
import WelcomeBannerBottomSheet from "components/screens/HomeScreen/WelcomeBannerBottomSheet";
import Icon from "components/sds/Icon";
import { Display } from "components/sds/Typography";
import {
  DEFAULT_PADDING,
  isNativeAssetId,
  NATIVE_TOKEN_CODE,
} from "config/constants";
import {
  MainTabStackParamList,
  MAIN_TAB_ROUTES,
  MANAGE_TOKENS_ROUTES,
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
import { usePricesStore } from "ducks/prices";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useWalletKitStore } from "ducks/walletKit";
import { getTokenType } from "helpers/balances";
import { fsValue, pxValue } from "helpers/dimensions";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useFilteredCollectibles } from "hooks/useFilteredCollectibles";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useHomeHeaders } from "hooks/useHomeHeaders";
import { useTotalBalance } from "hooks/useTotalBalance";
import { useWarmUpAccountsFiatTotals } from "hooks/useWarmUpAccountsFiatTotals";
import { useWelcomeBanner } from "hooks/useWelcomeBanner";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  View,
  ScrollView,
  RefreshControl,
} from "react-native";

// Bottom padding reserved at the end of the Home scroll content so the floating
// "+ Add" pill (its height plus its bottom offset) never covers the last row.
const FLOATING_ADD_BUTTON_CLEARANCE = 88;

// Line height of the `Display lg` fiat hero (see Typography's DISPLAY_SIZES):
// the hero's container is fixed to it so swapping between the loading spinner
// and the total never shifts the layout below.
const DISPLAY_LG_LINE_HEIGHT = 56;

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
    const connectedAppsBottomSheetRef = useRef<BottomSheetModal>(null);
    const debugBottomSheetRef = useRef<BottomSheetModal>(null);
    const walletConnectE2EHelperRef = useRef<WalletConnectE2EHelperRef>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>(TabType.TOKENS);

    const { t } = useAppTranslation();

    const { totalLabel, hasFiatTotal } = useTotalBalance();
    const {
      balances,
      isFunded,
      isLoading: isLoadingBalances,
      fetchAccountBalances,
    } = useBalancesStore();
    const fetchCollectibles = useCollectiblesStore((s) => s.fetchCollectibles);
    const isCollectiblesLoading = useCollectiblesStore((s) => s.isLoading);
    // Same source the grid renders from, so "empty" here means what the user
    // sees on that tab.
    const { visibleCollectibles } = useFilteredCollectibles();
    // Covers the balances store's 3s price-timeout path: balances settle
    // with an unpriced map while quotes are still in flight, so the hero
    // must keep its spinner until the prices store finishes too.
    const isPricesLoading = usePricesStore((state) => state.isLoading);
    const { fetchActiveSessions } = useWalletKitStore();
    const { swap_enabled: swapEnabled } = useRemoteConfigStore();
    const fetchAccountsFiatTotals = useAccountsFiatTotalsStore(
      (state) => state.fetchAccountsFiatTotals,
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

    // The tokens tab decides the Add button style for both tabs, and its pill
    // appears exactly when funded — so driving both off that one flag keeps
    // the in-empty-state CTA and the pill exact complements.
    const showEmptyStateCta = !isFunded;

    // ...but that CTA can only mount inside the collectibles empty state, so a
    // grid with content has nowhere to host it. Suppressing the pill there too
    // would leave the tab with no way to add a collectible at all — reachable
    // for real, since holding one needs no funded account (no trustline, no
    // reserve). So the pill stands down only when the CTA actually renders.
    const isCollectiblesGridEmpty = visibleCollectibles.length === 0;
    const showCollectiblesPill = !(
      showEmptyStateCta && isCollectiblesGridEmpty
    );

    const handleManageAccountsPress = useCallback(() => {
      manageAccountsBottomSheetRef.current?.present();
    }, []);

    const handleConnectedAppsPress = useCallback(() => {
      connectedAppsBottomSheetRef.current?.present();
    }, []);

    // Set up navigation headers (hook handles navigation.setOptions
    // internally); the account switcher lives in the header now.
    useHomeHeaders({
      navigation,
      onAccountPress: handleManageAccountsPress,
      onConnectedAppsPress: handleConnectedAppsPress,
    });

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

    // Prefetch the wallets-list USD totals in the background so the account
    // list opens with final values instead of loading placeholders.
    useWarmUpAccountsFiatTotals();

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

        if (isNativeAssetId(tokenId)) {
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

    const handleAddTokenPress = useCallback(() => {
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_TOKENS_STACK, {
        screen: MANAGE_TOKENS_ROUTES.ADD_TOKEN_SCREEN,
      });
    }, [navigation]);

    const handleAddCollectiblePress = useCallback(() => {
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.ADD_COLLECTIBLE_SCREEN);
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
          // The active account is skipped — the balances fetch above updates
          // it through the sync.
          allAccounts.length > 0
            ? fetchAccountsFiatTotals({
                publicKeys: allAccounts.map(
                  (walletAccount) => walletAccount.publicKey,
                ),
                network,
                forceRefresh: true,
                excludePublicKey: account.publicKey,
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
        <ConnectedApps
          navigation={navigation}
          bottomSheetRef={connectedAppsBottomSheetRef}
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
          contentContainerStyle={{
            flexGrow: 1,
            // Reserve space so the floating add pill never obscures the last
            // list row when scrolled to the bottom.
            paddingBottom: pxValue(FLOATING_ADD_BUTTON_CLEARANCE),
          }}
        >
          {/* Fixed at the Display lg line height so swapping between the
              spinner and the total never shifts the layout below. */}
          <View
            className="pt-[35px] w-full items-center justify-center"
            style={{ height: pxValue(35) + fsValue(DISPLAY_LG_LINE_HEIGHT) }}
          >
            {(isLoadingBalances || isPricesLoading) && !hasFiatTotal ? (
              // On a cold start the sum of an empty/unpriced map is a
              // placeholder $0.00 — a spinner beats flashing a scary zero
              // at the top of a funded wallet. Once a real total exists,
              // later loads keep showing it (no spinner flicker per poll).
              <ActivityIndicator
                testID="home-fiat-total-spinner"
                size="large"
                color={themeColors.foreground.primary}
              />
            ) : (
              <Display lg medium>
                {totalLabel}
              </Display>
            )}
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
            onTabChange={setActiveTab}
            publicKey={account?.publicKey ?? ""}
            network={network}
            onTokenPress={handleTokenPress}
            onCollectiblePress={handleCollectiblePress}
            balanceRowTestIDPrefix="home-token"
            showEmptyStateCta={showEmptyStateCta}
            onAddCollectiblePress={handleAddCollectiblePress}
          />
        </ScrollView>

        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 items-center"
          style={{ bottom: pxValue(DEFAULT_PADDING) }}
        >
          {/* Adding a token creates a trustline, which needs XLM for the
              reserve + fee — so the pill is only useful once the account is
              funded. */}
          {activeTab === TabType.TOKENS && isFunded && (
            <FloatingTabActionButton
              label={t("balancesList.addTokenButton")}
              onPress={handleAddTokenPress}
              testID="home-add-token-button"
            />
          )}
          {/* Stands down only while the collectibles empty state is carrying
              the CTA itself, so the two are never both on screen — and the tab
              is never left without either. */}
          {activeTab === TabType.COLLECTIBLES && showCollectiblesPill && (
            <FloatingTabActionButton
              label={t("collectiblesGrid.addCollectibleButton")}
              onPress={handleAddCollectiblePress}
              disabled={isCollectiblesLoading}
              testID="home-add-collectible-button"
            />
          )}
        </View>

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
