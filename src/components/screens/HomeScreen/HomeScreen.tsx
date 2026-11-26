import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { HeaderHeightContext } from "@react-navigation/elements";
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
import { getNavigationHeaderHeight } from "components/layout/CustomNavigationHeader";
import ConnectedApps from "components/screens/HomeScreen/ConnectedApps";
import ManageAccounts from "components/screens/HomeScreen/ManageAccounts";
import Icon from "components/sds/Icon";
import { Display, DISPLAY_SIZES } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
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
import { isNativeAssetId } from "helpers/assetIdentity";
import { getTokenType } from "helpers/balances";
import { fsValue } from "helpers/dimensions";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useFilteredCollectibles } from "hooks/useFilteredCollectibles";
import { useFloatingTabBarClearance } from "hooks/useFloatingTabBarClearance";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useHomeHeaders } from "hooks/useHomeHeaders";
import { useScrollUnderHeader } from "hooks/useScrollUnderHeader";
import { useTotalBalance } from "hooks/useTotalBalance";
import { useWarmUpAccountsFiatTotals } from "hooks/useWarmUpAccountsFiatTotals";
import React, {
  useCallback,
  useContext,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Figma's Display/LG/600, which the fiat hero is set in: Inter SemiBold 48/56
// (Typography's DISPLAY_SIZES.lg) with -4% letter spacing. React Native takes
// the spacing in points, so it is a fraction of the font size.
const DISPLAY_LG_LETTER_SPACING = -0.04;

type HomeScreenProps = BottomTabScreenProps<
  MainTabStackParamList & RootStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HOME
>;

/**
 * The Home tab: the account's fiat total, the Add, Send and Swap tiles, and
 * the Tokens and Collectibles tabs, each list ending with its inline add
 * button. Its header floats over it (`useHomeHeaders`), so the content scrolls
 * up under the header's fade and starts below it, and the content ends above
 * the floating tab bar. Pull to refresh reloads balances, collectibles,
 * connected apps and the accounts' totals.
 */
export const HomeScreen: React.FC<HomeScreenProps> = React.memo(
  ({ navigation }) => {
    const { account } = useGetActiveAccount();
    const { network, getAllAccounts, allAccounts, isLoadingAllAccounts } =
      useAuthenticationStore();
    const { themeColors } = useColors();
    // The screen runs under the floating tab bar, so the scroll content ends
    // this far up for the last item to scroll clear of the pill.
    const tabBarClearance = useFloatingTabBarClearance();
    // The header floats over the screen too (useHomeHeaders), so the content
    // and the refresh spinner start below it. Until the navigator measures
    // the header it reports a generic height shorter than the bar, so the
    // bar's own height is the floor; a banner makes the measured one taller.
    const measuredHeaderHeight = useContext(HeaderHeightContext);
    const { top: topInset } = useSafeAreaInsets();
    const headerHeight = Math.max(
      measuredHeaderHeight ?? 0,
      getNavigationHeaderHeight(topInset),
    );
    const { scrollViewProps, fillStyle, progressViewOffset } =
      useScrollUnderHeader(headerHeight);
    const manageAccountsBottomSheetRef = useRef<BottomSheetModal>(null);
    const connectedAppsBottomSheetRef = useRef<BottomSheetModal>(null);
    const debugBottomSheetRef = useRef<BottomSheetModal>(null);
    const walletConnectE2EHelperRef = useRef<WalletConnectE2EHelperRef>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);

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
    const collectiblesError = useCollectiblesStore((s) => s.error);
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

    // The collectibles grid carries its own Add Collectible button, funded
    // or not, wherever it shows no collectibles: in its empty card (Figma
    // ?node-id=372-11772) and in its error view, which replaces the grid while
    // a fetch fails, even over collectibles from an earlier fetch. Add
    // collectible ends a grid with content instead, so the two are never on
    // screen together. Holding a collectible needs no funded account, so a
    // grid with content can follow an unfunded tokens tab too.
    // It also goes while collectibles load, a pull to refresh included: the
    // grid then shows a spinner that fills the tab, which would push the
    // button to the bottom of the screen.
    const isCollectiblesGridEmpty = visibleCollectibles.length === 0;
    const showAddCollectibleButton =
      !isCollectiblesLoading && !isCollectiblesGridEmpty && !collectiblesError;

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
          {...scrollViewProps}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                handleRefresh();
              }}
              tintColor={themeColors.secondary}
              progressViewOffset={progressViewOffset}
            />
          }
          contentContainerStyle={{
            ...fillStyle,
            paddingBottom: tabBarClearance,
          }}
        >
          {/* Fixed at the Display lg line height so swapping between the
              spinner and the total never shifts the layout below. Only the
              header's height pads it above: the bar's own bottom padding is
              the gap. */}
          <View
            className="w-full px-[16px] items-center justify-center"
            style={{ height: fsValue(DISPLAY_SIZES.lg.lineHeight) }}
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
              // One line only: the box is fixed to it, so a long total that
              // wrapped would spill onto the action tiles. It shrinks to fit
              // instead, down to 60%.
              <Display
                lg
                semiBold
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{
                  letterSpacing:
                    DISPLAY_LG_LETTER_SPACING *
                    fsValue(DISPLAY_SIZES.lg.fontSize),
                }}
              >
                {totalLabel}
              </Display>
            )}
          </View>

          {/* 24pt from the total above and from the tabs below (Figma
              662:9780); the tab row pads its own sides. */}
          <View className="flex-row gap-[12px] w-full px-[16px] mt-[24px] mb-[24px]">
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
            publicKey={account?.publicKey ?? ""}
            network={network}
            onTokenPress={handleTokenPress}
            onCollectiblePress={handleCollectiblePress}
            balanceRowTestIDPrefix="home-token"
            onAddCollectiblePress={handleAddCollectiblePress}
            // Adding a token creates a trustline, which needs XLM for the
            // reserve + fee — so its button is only useful once the account is
            // funded.
            onAddTokenPress={handleAddTokenPress}
            showAddTokenButton={isFunded}
            // Stands down while the grid's empty card or error view carries
            // its own button, so the two are never both on screen, and while
            // the collectibles load.
            showAddCollectibleButton={showAddCollectibleButton}
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
