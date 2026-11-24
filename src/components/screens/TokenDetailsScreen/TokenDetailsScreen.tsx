/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react-hooks/exhaustive-deps */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigatorScreenParams } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { useSelectSwapDestination } from "components/screens/SwapScreen/hooks/useSelectSwapDestination";
import {
  NonHeldTokenHeader,
  TokenBalanceHeader,
  TokenBalanceDetails,
} from "components/screens/TokenDetailsScreen/components";
import AboutSection from "components/screens/TokenDetailsScreen/components/PriceHistory/AboutSection";
import TokenPriceHistorySection from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceHistorySection";
import TokenStatsSection from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenStatsSection";
import {
  getRemoveTokenSheetVariant,
  isTokenRemovable,
  RemoveTokenSheetContent,
  RemoveTokenSheetVariant,
} from "components/screens/TokenDetailsScreen/components/RemoveTokenSheetContent";
import { SwapToFooter } from "components/screens/TokenDetailsScreen/components/SwapToFooter";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  AnalyticsEvent,
  SwapSelectionSource,
  TokenChartSource,
} from "config/analyticsConfig";
import {
  NATIVE_TOKEN_CODE,
  SWAP_SELECTION_TYPES,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import {
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  SWAP_ROUTES,
  SEND_PAYMENT_ROUTES,
  SwapStackParamList,
} from "config/routes";
import { TokenTypeWithCustomToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useDebugStore } from "ducks/debug";
import { useIsInspectingPriceHistory } from "ducks/priceHistory";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useSwapStore } from "ducks/swap";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { isNativeAssetId } from "helpers/assetIdentity";
import { getTokenType, getIssuerFromIdentifier } from "helpers/balances";
import { isContractId } from "helpers/soroban";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useManageToken } from "hooks/useManageToken";
import usePriceHistoryEnabled from "hooks/usePriceHistoryEnabled";
import { useRightHeaderMenu } from "hooks/useRightHeader";
import { useTokenActions } from "hooks/useTokenActions";
import useTokenDetails from "hooks/useTokenDetails";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { View, Platform, ScrollView } from "react-native";
import { analytics } from "services/analytics";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";
import {
  assessTokenSecurity,
  extractSecurityWarnings,
  SecurityWarning,
} from "services/blockaid/helper";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

const headerMenuIcons = Platform.select({
  ios: {
    copyAddress: "doc.on.doc",
    hideToken: "eye.slash",
    removeToken: "minus.circle",
    viewOnExplorer: "link",
  },
  android: {
    copyAddress: "baseline_format_paint",
    hideToken: "visibility_off",
    removeToken: "outline_circle",
    viewOnExplorer: "public",
  },
});

type TokenDetailsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN
>;

/**
 * Token Details Screen component showing transaction history for a specific token
 */
/**
 * A hidden or removed token can no longer be swapped: clear it from whichever
 * side of the in-progress swap holds it. Clearing the source resets its
 * amount (see the swap store).
 */
const dropFromSwap = (tokenId: string) => {
  const {
    sourceTokenId,
    destinationToken,
    setSourceToken,
    setDestinationToken,
  } = useSwapStore.getState();
  if (sourceTokenId === tokenId) {
    setSourceToken("", "");
  }
  if (destinationToken?.id === tokenId) {
    setDestinationToken(null);
  }
};

const TokenDetailsScreen: React.FC<TokenDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const { tokenId, tokenSymbol, record } = route.params;
  const source = route.params.source ?? TokenChartSource.BALANCES;
  const isFromBalances = source === TokenChartSource.BALANCES;
  const isFromSwapAmount = source === TokenChartSource.SWAP_AMOUNT;
  const isFromSwapPicker = source === TokenChartSource.SWAP_PICKER;
  // The source ("Swap from") picker lists held tokens only.
  const isSwapSourcePick =
    isFromSwapPicker &&
    route.params.swapSelectionType === SWAP_SELECTION_TYPES.SOURCE;
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const { swap_enabled: swapEnabled } = useRemoteConfigStore();
  // One shared predicate (kill switch + mainnet) for all three price-history
  // sections; each section also enforces it itself, so they cannot drift.
  const priceHistoryEnabled = usePriceHistoryEnabled(network);
  // While a drag-to-inspect is in progress on the chart, the list must not
  // steal the gesture mid-drag: the long-press already arbitrated the START
  // of the gesture, scroll would arbitrate it a second time.
  const isInspectingChart = useIsInspectingPriceHistory(network, tokenId);
  const { overriddenBlockaidResponse } = useDebugStore();
  const { saveSelectedTokenId, saveSelectedCollectibleDetails } =
    useTransactionSettingsStore();
  const hideToken = useBalancesStore((state) => state.hideToken);
  const { showToast } = useToast();
  const { open: openInAppBrowser } = useInAppBrowser();
  const securityWarningBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { actualTokenDetails, displayTitle } = useTokenDetails({
    tokenId,
    tokenSymbol,
    publicKey: account?.publicKey,
    network,
  });

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const {
    historyData,
    fetchData,
    isLoading,
    error,
    isRefreshing,
    isNavigationRefresh,
  } = useGetHistoryData({
    publicKey: account?.publicKey ?? "",
    networkDetails,
    tokenId,
  });

  const {
    scanResults,
    balanceItems,
    hiddenBalanceItems,
    localOnlyTokenIds,
    handleRefresh: refreshBalances,
  } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    // Keeps the token's balance resolved while a hide completes, so the menu
    // and the remove prompt don't lose it before the screen closes.
    includeHidden: true,
  });

  const removeTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { copyTokenAddress } = useTokenActions();

  const selectedBalance = useMemo(
    () => balanceItems.find((item) => item.id === tokenId) ?? null,
    [balanceItems, tokenId],
  );
  const isHeld = selectedBalance !== null;
  const isNoBalanceVariant = !isHeld && !!record;

  const { removeToken, isRemovingToken } = useManageToken({
    token: selectedBalance
      ? {
          type: selectedBalance.tokenType,
          code: selectedBalance.tokenCode!,
          id: selectedBalance.id,
          issuer: getIssuerFromIdentifier(selectedBalance.id),
        }
      : null,
    network,
    account,
    bottomSheetRefRemove: removeTokenBottomSheetModalRef,
    onSuccess: () => {
      // Refresh balances so Home reflects the removal immediately instead of
      // waiting for the next focused poll.
      refreshBalances();
      dropFromSwap(tokenId);
      navigation.goBack();
    },
  });

  // The prompt reports a signing outcome only when it offers the removal
  // confirmation for a trustline. It offers no signing decision when it
  // explains that the wallet cannot remove the token, and a local-only token
  // never signs.
  const promptSigns =
    getRemoveTokenSheetVariant(selectedBalance, localOnlyTokenIds) ===
      RemoveTokenSheetVariant.confirm &&
    selectedBalance?.tokenType !== TokenTypeWithCustomToken.CUSTOM_TOKEN;

  // True once the user approves. Cleared as the sheet opens, because a
  // dismissal does not always run.
  const hasApprovedRemoveRef = useRef(false);

  /**
   * Reports a rejection when the user leaves the removal prompt without
   * approving, by any route.
   */
  const handleRemoveDismiss = useCallback(() => {
    if (hasApprovedRemoveRef.current || !promptSigns) {
      return;
    }
    analytics.trackInternalSignedTransactionRejected();
  }, [promptSigns]);

  const handleCancelTokenRemoval = useCallback(() => {
    if (selectedBalance) {
      analytics.trackRemoveTokenRejected(selectedBalance.tokenCode);
    }
    removeTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedBalance]);

  // XLM pays every transaction fee, so it is never hidden: Send and Swap
  // would stop seeing it and report insufficient XLM for fees.
  const canOfferHide =
    !isNativeAssetId(tokenId) &&
    !hiddenBalanceItems.some((item) => item.id === tokenId);
  // Neither XLM nor LP shares can ever be removed here, so Remove isn't
  // offered for them rather than opening a sheet that only says so.
  const tokenType = getTokenType(tokenId);
  const canOfferRemove =
    tokenType !== TokenTypeWithCustomToken.NATIVE &&
    tokenType !== TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES &&
    isTokenRemovable(selectedBalance, localOnlyTokenIds);
  // The code the menu and toasts name the token by. The route's symbol is
  // the code for a classic asset, but the contract id for a Soroban token
  // until its details resolve.
  const hideTokenCode =
    selectedBalance?.tokenCode ??
    (isContractId(tokenSymbol) ? actualTokenDetails?.symbol : undefined) ??
    tokenSymbol;

  /**
   * Hides the token, then returns to the previous screen and confirms with a
   * toast. An already hidden token offers no Hide (Add token can open one);
   * unhiding happens from Add token.
   */
  const handleHideToken = useCallback(async () => {
    const publicKey = account?.publicKey;

    if (!publicKey) {
      return;
    }

    try {
      await hideToken({ publicKey, network, tokenId });
      dropFromSwap(tokenId);

      navigation.goBack();

      showToast({
        title: t("hiddenTokens.hidden", { tokenCode: hideTokenCode }),
        variant: "success",
        toastId: "hide-token-toast",
      });
    } catch {
      showToast({
        title: t("hiddenTokens.hideError", { tokenCode: hideTokenCode }),
        variant: "error",
        toastId: "hide-token-toast",
      });
    }
  }, [
    account?.publicKey,
    hideToken,
    network,
    tokenId,
    navigation,
    showToast,
    t,
    hideTokenCode,
  ]);

  // stellar.expert's page for the token, as the swap picker rows link it.
  const stellarExpertUrl = useMemo(() => {
    const base = getStellarExpertUrl(network);
    if (isNativeAssetId(tokenId)) {
      return `${base}/asset/${NATIVE_TOKEN_CODE}`;
    }
    if (isContractId(tokenId)) {
      return `${base}/contract/${tokenId}`;
    }
    // A symbol can contain a colon, so the issuer is after the last one.
    const separator = tokenId.lastIndexOf(":");
    const code = tokenId.slice(0, separator);
    const issuer = tokenId.slice(separator + 1);
    return isContractId(issuer)
      ? `${base}/contract/${issuer}`
      : `${base}/asset/${code}-${issuer}`;
  }, [network, tokenId]);

  // Hide and Remove follow the held balance, whatever opened the screen;
  // Home also offers them before balances load.
  const canOfferBalanceActions = isFromBalances || isHeld;
  const headerMenuActions = useMemo(
    () => [
      {
        title: t("manageTokenRightContent.copyAddress"),
        systemIcon: headerMenuIcons!.copyAddress,
        onPress: () =>
          copyTokenAddress(
            tokenId,
            "manageTokenRightContent.tokenAddressCopied",
          ),
      },
      ...(canOfferBalanceActions && canOfferHide
        ? [
            {
              title: t("tokenDetailsScreen.hideToken", {
                tokenCode: hideTokenCode,
              }),
              systemIcon: headerMenuIcons!.hideToken,
              onPress: () => {
                // handleHideToken reports its own failures with a toast and
                // never rejects; the catch only keeps the promise from
                // floating.
                handleHideToken().catch(() => undefined);
              },
            },
          ]
        : []),
      ...(canOfferBalanceActions && canOfferRemove
        ? [
            {
              title: t("common.remove"),
              systemIcon: headerMenuIcons!.removeToken,
              destructive: true,
              onPress: () => removeTokenBottomSheetModalRef.current?.present(),
            },
          ]
        : []),
      // stellar.expert has no page for a pool share. getTokenType also
      // reports a bare contract id as one, which does have a page.
      ...(tokenType === TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES &&
      !isContractId(tokenId)
        ? []
        : [
            {
              title: t("swapScreen.viewOnStellarExpert"),
              systemIcon: headerMenuIcons!.viewOnExplorer,
              onPress: () => {
                openInAppBrowser(stellarExpertUrl).catch((err) => {
                  logger.error(
                    "TokenDetailsScreen",
                    "Failed to open stellar expert URL:",
                    err,
                  );
                });
              },
            },
          ]),
    ],
    [
      t,
      copyTokenAddress,
      tokenId,
      canOfferBalanceActions,
      canOfferHide,
      hideTokenCode,
      handleHideToken,
      canOfferRemove,
      openInAppBrowser,
      stellarExpertUrl,
      tokenType,
    ],
  );

  useRightHeaderMenu({
    actions: headerMenuActions,
    icon: Icon.DotsHorizontal,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: displayTitle,
    });
  }, [navigation, displayTitle]);

  const handleRefresh = useCallback(() => {
    fetchData({ isRefresh: true });
  }, [fetchData]);

  const handleSwapPress = () => {
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.SWAP_STACK, {
      screen: SWAP_ROUTES.SWAP_AMOUNT_SCREEN,
      // source tags swap.completed with the detail-view entry point (§7.5).
      params: { tokenId, tokenSymbol, source: "token_details" },
    });
  };

  // Liquidity-pool shares can't be swapped.
  const isSwappable =
    getTokenType(tokenId) !== TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES;

  const handleSendPress = () => {
    saveSelectedTokenId(tokenId);
    saveSelectedCollectibleDetails({ collectionAddress: "", tokenId: "" });
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK, {
      screen: SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN,
      params: {
        dismissToPreviousScreen: true,
      },
    });
  };
  const scanResult = scanResults[tokenId.replace(":", "-")];
  const heldSecurity = assessTokenSecurity(
    scanResult,
    overriddenBlockaidResponse,
  );
  // A token the account doesn't hold has no balances scan; its search record
  // carries the scan instead.
  const recordLevel = record?.securityLevel;
  const isMalicious = isNoBalanceVariant
    ? recordLevel === SecurityLevel.MALICIOUS || !!record?.isMalicious
    : heldSecurity.isMalicious;
  const isSuspicious = isNoBalanceVariant
    ? recordLevel === SecurityLevel.SUSPICIOUS || !!record?.isSuspicious
    : heldSecurity.isSuspicious;
  const isUnableToScan =
    isNoBalanceVariant &&
    (recordLevel === SecurityLevel.UNABLE_TO_SCAN || !!record?.isUnableToScan);

  const securityWarnings = useMemo((): SecurityWarning[] => {
    if (isNoBalanceVariant) {
      // Blockaid returns no feature-level warnings for an unable-to-scan
      // token; synthesize a row so the reasons list isn't blank.
      return isUnableToScan
        ? [
            {
              id: "unable-to-scan-trending-token",
              description: t("blockaid.unableToScan.token"),
              severity: "warning",
            },
          ]
        : (record?.securityWarnings ?? []);
    }

    if (isMalicious || isSuspicious) {
      const warnings = extractSecurityWarnings(scanResult);

      if (Array.isArray(warnings) && warnings.length > 0) {
        return warnings;
      }
    }

    return [];
  }, [
    isNoBalanceVariant,
    isUnableToScan,
    record?.securityWarnings,
    t,
    isMalicious,
    isSuspicious,
    scanResult,
  ]);

  // Back past the picker to the amount screen. It is already on the swap
  // stack, so `merge` keeps its params instead of re-sending them.
  const returnToSwapAmount = () =>
    navigation.navigate(
      ROOT_NAVIGATOR_ROUTES.SWAP_STACK,
      {
        screen: SWAP_ROUTES.SWAP_AMOUNT_SCREEN,
        merge: true,
        pop: true,
      } as NavigatorScreenParams<SwapStackParamList>,
      { pop: true },
    );

  // Swap To is offered from the swap amount screen and the destination
  // picker. A picker held row carries no record; the balance is picked by
  // id instead.
  const isSwapToDestination =
    (isFromSwapAmount || isFromSwapPicker) && !isSwapSourcePick;
  const swapToRecord = isSwapToDestination ? record : undefined;
  const swapToHeldId =
    isSwapToDestination && isFromSwapPicker && !record ? tokenId : undefined;
  const isSwapToDestinationOffered = !!swapToRecord || !!swapToHeldId;
  const isSwapToOffered = isSwapToDestinationOffered || isSwapSourcePick;
  const { select: selectSwapDestination, isPending: isSelectingSwapTo } =
    useSelectSwapDestination({
      record: swapToRecord,
      heldTokenId: swapToHeldId,
      selectionSource: isFromSwapPicker
        ? (route.params.swapSelectionSource ?? SwapSelectionSource.POPULAR)
        : SwapSelectionSource.TRENDING,
      onSelected: isFromSwapPicker
        ? returnToSwapAmount
        : () => navigation.goBack(),
    });

  // Swap from: the source picker's own held-row pick, then back to the
  // amount screen.
  const selectSwapSource = () => {
    const { destinationToken, setDestinationToken, setSourceToken } =
      useSwapStore.getState();
    analytics.track(AnalyticsEvent.SWAP_SOURCE_SELECTED, {
      asset_code: tokenSymbol,
      asset_issuer: tokenId.includes(":") ? tokenId.split(":")[1] : "",
      source:
        route.params.swapSelectionSource === SwapSelectionSource.SEARCH
          ? SwapSelectionSource.SEARCH
          : SwapSelectionSource.BALANCES,
    });
    // The same token cannot be on both sides.
    if (destinationToken && destinationToken.id === tokenId) {
      setDestinationToken(null);
    }
    setSourceToken(tokenId, tokenSymbol);
    returnToSwapAmount();
  };
  // Unable-to-scan is not flagged: the banner alone signals caution.
  const isFlagged = isMalicious || isSuspicious;

  // A held source needs no warning: the account holds it.
  const isSwapToFlagged = !isSwapSourcePick && isFlagged;
  let onSwapTo = selectSwapDestination;
  if (isSwapSourcePick) {
    onSwapTo = selectSwapSource;
  } else if (isSwapToFlagged) {
    onSwapTo = () => securityWarningBottomSheetModalRef.current?.present();
  }

  const securitySeverity = useMemo(() => {
    if (isMalicious) return SecurityLevel.MALICIOUS;
    if (isSuspicious) return SecurityLevel.SUSPICIOUS;
    if (isUnableToScan) return SecurityLevel.UNABLE_TO_SCAN;

    return undefined;
  }, [isMalicious, isSuspicious, isUnableToScan]);

  let securityBannerText: string | undefined;
  if (isMalicious) {
    securityBannerText = t("transactionAmountScreen.errors.malicious");
  } else if (isSuspicious) {
    securityBannerText = t("transactionAmountScreen.errors.suspicious");
  } else if (isUnableToScan) {
    securityBannerText = t("securityWarning.proceedWithCaution");
  }

  // EVERYTHING above the transactions lives in the list header, so
  // the screen scrolls as one column like the extension's does.
  // As siblings of the list these sat in a fixed flex row: the
  // chart ate ~250px of viewport, the list scrolled inside what was
  // left, and on a token with no transactions nothing scrolled at
  // all. Order matches the extension: name, price and delta, then
  // the chart, then the holdings it describes.
  const renderAboveList = () => (
    <View className="mb-6 max-xs:mb-0 gap-8 max-xs:gap-4">
      {isNoBalanceVariant ? (
        <NonHeldTokenHeader
          tokenId={tokenId}
          network={network}
          record={record}
        />
      ) : (
        <TokenBalanceHeader
          tokenId={tokenId}
          tokenSymbol={tokenSymbol}
          network={network}
          actualTokenSymbol={actualTokenDetails?.symbol}
          tokenName={actualTokenDetails?.name}
        />
      )}
      {/* Above the chart, deliberately: the chart block is ~250px
          tall, and a flagged token's warning sat directly under the
          header before this feature existed. Only shown when
          flagged, so the ordinary layout is unchanged. */}
      {securityBannerText && (
        <Banner
          variant={isSuspicious || !isMalicious ? "warning" : "error"}
          text={securityBannerText}
          onPress={() => securityWarningBottomSheetModalRef.current?.present()}
        />
      )}
      {priceHistoryEnabled && (
        <TokenPriceHistorySection
          tokenId={tokenId}
          network={network}
          source={source}
        />
      )}
      {!isNoBalanceVariant && (
        <TokenBalanceDetails tokenId={tokenId} network={network} />
      )}
      {priceHistoryEnabled && (
        <TokenStatsSection tokenId={tokenId} network={network} />
      )}
      {priceHistoryEnabled && (
        <AboutSection tokenId={tokenId} network={network} />
      )}
      {!isNoBalanceVariant && (
        <Text md medium secondary>
          {t("tokenDetailsScreen.listHeader", {
            tokenName: displayTitle,
          })}
        </Text>
      )}
    </View>
  );

  return (
    // The bottom inset (the safe area plus 24pt) keeps Swap and Send where
    // Figma has them, with nothing under them.
    <BaseLayout insets={{ top: false, bottom: true }}>
      <View testID="token-details-screen" className="flex-1 mt-5 max-xs:mt-2">
        {isNoBalanceVariant ? (
          <ScrollView
            scrollEnabled={!isInspectingChart}
            showsVerticalScrollIndicator={false}
          >
            {renderAboveList()}
          </ScrollView>
        ) : (
          <HistoryList
            ignoreTopInset
            noHorizontalPadding
            loadingPlaceholder="skeleton"
            historyData={historyData}
            isLoading={isLoading}
            error={error}
            publicKey={account?.publicKey ?? ""}
            networkDetails={networkDetails}
            onRefresh={handleRefresh}
            refreshActionPosition="start"
            isRefreshing={isRefreshing}
            isNavigationRefresh={isNavigationRefresh}
            scrollEnabled={!isInspectingChart}
            ListHeaderComponent={renderAboveList()}
          />
        )}
      </View>
      {isFromSwapAmount || isFromSwapPicker
        ? isSwapToOffered && (
            <View className="mt-7">
              <SwapToFooter
                tokenCode={swapToRecord?.tokenCode ?? tokenSymbol}
                side={isSwapSourcePick ? "from" : "to"}
                isFlagged={isSwapToFlagged}
                isMalicious={isMalicious}
                isPending={isSelectingSwapTo}
                onSwapTo={onSwapTo}
                onCancel={() => navigation.goBack()}
              />
            </View>
          )
        : isFromBalances && (
            <View className="mt-7">
              <View className="flex-row gap-3">
                {swapEnabled && isSwappable && (
                  <View className="flex-1">
                    <Button secondary xl isFullWidth onPress={handleSwapPress}>
                      {t("tokenDetailsScreen.swap")}
                    </Button>
                  </View>
                )}
                <View className="flex-1">
                  <Button
                    secondary
                    xl
                    isFullWidth
                    onPress={handleSendPress}
                    testID="token-details-send-button"
                  >
                    {t("tokenDetailsScreen.send")}
                  </Button>
                </View>
              </View>
            </View>
          )}
      <BottomSheet
        modalRef={securityWarningBottomSheetModalRef}
        customContent={
          <SecurityDetailBottomSheet
            warnings={securityWarnings}
            onClose={() =>
              securityWarningBottomSheetModalRef.current?.dismiss()
            }
            severity={securitySeverity}
            securityContext={SecurityContext.TOKEN}
            {...(isSwapToDestinationOffered && {
              onCancel: () =>
                securityWarningBottomSheetModalRef.current?.dismiss(),
              onProceedAnyway: () => {
                securityWarningBottomSheetModalRef.current?.dismiss();
                selectSwapDestination();
              },
              proceedAnywayText: isUnableToScan
                ? t("common.continue")
                : t("swapScreen.trendingDetail.swapToAnyway", {
                    tokenCode: swapToRecord?.tokenCode ?? tokenSymbol,
                  }),
            })}
          />
        }
      />
      {/* Not isHeld: Remove is offered before balances load, and its
          sheet must still open. */}
      {!isNoBalanceVariant && (
        <BottomSheet
          modalRef={removeTokenBottomSheetModalRef}
          bottomSheetModalProps={{
            onChange: (index: number) => {
              if (index >= 0) {
                hasApprovedRemoveRef.current = false;
              }
            },
            onDismiss: handleRemoveDismiss,
          }}
          analyticsEvent={AnalyticsEvent.VIEW_REMOVE_TOKEN}
          shouldCloseOnPressBackdrop={!!selectedBalance}
          customContent={
            <RemoveTokenSheetContent
              selectedToken={selectedBalance}
              localOnlyTokenIds={localOnlyTokenIds}
              account={account}
              onCancel={handleCancelTokenRemoval}
              onRemoveToken={() => {
                hasApprovedRemoveRef.current = true;
                return removeToken();
              }}
              isRemovingToken={isRemovingToken}
              onDismiss={() =>
                removeTokenBottomSheetModalRef.current?.dismiss()
              }
            />
          }
        />
      )}
    </BaseLayout>
  );
};

export default TokenDetailsScreen;
