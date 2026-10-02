/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react-hooks/exhaustive-deps */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import {
  TokenBalanceHeader,
  TokenBalanceDetails,
} from "components/screens/TokenDetailsScreen/components";
import AboutSection from "components/screens/TokenDetailsScreen/components/PriceHistory/AboutSection";
import TokenPriceHistorySection from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceHistorySection";
import TokenStatsSection from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenStatsSection";
import {
  getRemoveTokenSheetVariant,
  RemoveTokenSheetContent,
  RemoveTokenSheetVariant,
} from "components/screens/TokenDetailsScreen/components/RemoveTokenSheetContent";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { mapNetworkToNetworkDetails } from "config/constants";
import {
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  SWAP_ROUTES,
  SEND_PAYMENT_ROUTES,
} from "config/routes";
import { TokenTypeWithCustomToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { getTokenType, getIssuerFromIdentifier } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import { useManageToken } from "hooks/useManageToken";
import usePriceHistoryEnabled from "hooks/usePriceHistoryEnabled";
import { useRightHeaderMenu } from "hooks/useRightHeader";
import { useTokenActions } from "hooks/useTokenActions";
import useTokenDetails from "hooks/useTokenDetails";
import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { View, Dimensions, Platform } from "react-native";
import { analytics } from "services/analytics";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";
import {
  assessTokenSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

const headerMenuIcons = Platform.select({
  ios: {
    copyAddress: "doc.on.doc",
    removeToken: "minus.circle",
  },
  android: {
    copyAddress: "baseline_format_paint",
    removeToken: "outline_circle",
  },
});

type TokenDetailsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN
>;

/**
 * Token Details Screen component showing transaction history for a specific token
 */
const TokenDetailsScreen: React.FC<TokenDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const { tokenId, tokenSymbol } = route.params;
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const { width } = Dimensions.get("window");
  const { swap_enabled: swapEnabled } = useRemoteConfigStore();
  // One shared predicate (kill switch + mainnet) for all three price-history
  // sections; each section also enforces it itself, so they cannot drift.
  const priceHistoryEnabled = usePriceHistoryEnabled(network);
  const { overriddenBlockaidResponse } = useDebugStore();
  const { saveSelectedTokenId, saveSelectedCollectibleDetails } =
    useTransactionSettingsStore();
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
    localOnlyTokenIds,
    handleRefresh: refreshBalances,
  } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });

  const removeTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { copyTokenAddress } = useTokenActions();

  const selectedBalance = useMemo(
    () => balanceItems.find((item) => item.id === tokenId) ?? null,
    [balanceItems, tokenId],
  );

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
      {
        title: t("common.remove"),
        systemIcon: headerMenuIcons!.removeToken,
        destructive: true,
        onPress: () => removeTokenBottomSheetModalRef.current?.present(),
      },
    ],
    [t, copyTokenAddress, tokenId],
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

  // Classic Stellar assets = native (XLM) + credit_alphanum4/12. Soroban
  // custom tokens (CUSTOM_TOKEN) and liquidity-pool shares aren't supported
  // by the swap flow yet, so the Swap CTA is gated on this.
  const isClassicAsset =
    getTokenType(tokenId) === TokenTypeWithCustomToken.NATIVE ||
    getTokenType(tokenId) === TokenTypeWithCustomToken.CREDIT_ALPHANUM4 ||
    getTokenType(tokenId) === TokenTypeWithCustomToken.CREDIT_ALPHANUM12;

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
  const { isMalicious, isSuspicious } = assessTokenSecurity(
    scanResult,
    overriddenBlockaidResponse,
  );

  const securityWarnings = useMemo(() => {
    if (isMalicious || isSuspicious) {
      const warnings = extractSecurityWarnings(scanResult);

      if (Array.isArray(warnings) && warnings.length > 0) {
        return warnings;
      }
    }

    return [];
  }, [isMalicious, isSuspicious, scanResult]);

  const securitySeverity = useMemo(() => {
    if (isMalicious) return SecurityLevel.MALICIOUS;
    if (isSuspicious) return SecurityLevel.SUSPICIOUS;

    return undefined;
  }, [isMalicious, isSuspicious]);

  return (
    <BaseLayout insets={{ top: false, bottom: false }}>
      <View testID="token-details-screen" className="flex-1 mt-5 max-xs:mt-2">
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
          ListHeaderComponent={
            /* EVERYTHING above the transactions lives in the list header, so
               the screen scrolls as one column like the extension's does.
               As siblings of the list these sat in a fixed flex row: the
               chart ate ~250px of viewport, the list scrolled inside what was
               left, and on a token with no transactions nothing scrolled at
               all. Order matches the extension: name, price and delta, then
               the chart, then the holdings it describes. */
            <View className="mb-6 max-xs:mb-0 gap-8 max-xs:gap-4">
              <TokenBalanceHeader
                tokenId={tokenId}
                tokenSymbol={tokenSymbol}
                network={network}
                actualTokenSymbol={actualTokenDetails?.symbol}
                tokenName={actualTokenDetails?.name}
              />
              {/* Above the chart, deliberately: the chart block is ~250px
                  tall, and a flagged token's warning sat directly under the
                  header before this feature existed. Only shown when
                  flagged, so the ordinary layout is unchanged. */}
              {(isMalicious || isSuspicious) && (
                <Banner
                  variant={isSuspicious ? "warning" : "error"}
                  text={
                    isMalicious
                      ? t("transactionAmountScreen.errors.malicious")
                      : t("transactionAmountScreen.errors.suspicious")
                  }
                  onPress={() =>
                    securityWarningBottomSheetModalRef.current?.present()
                  }
                />
              )}
              {priceHistoryEnabled && (
                <TokenPriceHistorySection tokenId={tokenId} network={network} />
              )}
              <TokenBalanceDetails tokenId={tokenId} />
              {priceHistoryEnabled && (
                <TokenStatsSection tokenId={tokenId} network={network} />
              )}
              {priceHistoryEnabled && (
                <AboutSection tokenId={tokenId} network={network} />
              )}
              <Text md medium secondary>
                {t("tokenDetailsScreen.listHeader", {
                  tokenName: displayTitle,
                })}
              </Text>
            </View>
          }
        />
      </View>
      <View className="mt-7 pb-3 gap-7">
        <View className="flex-row gap-3">
          {swapEnabled && isClassicAsset && (
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
        <View
          className="border-b mb-6 -ml-7 border-border-primary"
          style={{ width }}
        />
      </View>
      <BottomSheet
        modalRef={securityWarningBottomSheetModalRef}
        handleCloseModal={() =>
          securityWarningBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <SecurityDetailBottomSheet
            warnings={securityWarnings}
            onClose={() =>
              securityWarningBottomSheetModalRef.current?.dismiss()
            }
            severity={securitySeverity}
            securityContext={SecurityContext.TOKEN}
          />
        }
      />
      <BottomSheet
        modalRef={removeTokenBottomSheetModalRef}
        handleCloseModal={() =>
          removeTokenBottomSheetModalRef.current?.dismiss()
        }
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
            onDismiss={() => removeTokenBottomSheetModalRef.current?.dismiss()}
          />
        }
      />
    </BaseLayout>
  );
};

export default TokenDetailsScreen;
