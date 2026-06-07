/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react-hooks/exhaustive-deps */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { TokenBalanceHeader } from "components/screens/TokenDetailsScreen/components";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
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
import { getTokenType } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import useTokenDetails from "hooks/useTokenDetails";
import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { View, Dimensions } from "react-native";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";
import {
  assessTokenSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

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

  const { scanResults } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
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
      params: { tokenId, tokenSymbol },
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
      <View
        testID="token-details-screen"
        className="flex-1 gap-8 mt-5 max-xs:mt-2 max-xs:gap-4"
      >
        <TokenBalanceHeader
          tokenId={tokenId}
          tokenSymbol={tokenSymbol}
          actualTokenSymbol={actualTokenDetails?.symbol}
          tokenName={actualTokenDetails?.name}
        />
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
        <HistoryList
          ignoreTopInset
          noHorizontalPadding
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
            <View className="mb-6 max-xs:mb-0">
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
              <Button tertiary xl isFullWidth onPress={handleSwapPress}>
                {t("tokenDetailsScreen.swap")}
              </Button>
            </View>
          )}
          <View className="flex-1">
            <Button
              tertiary
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
            severity={securitySeverity ?? SecurityLevel.MALICIOUS}
            securityContext={SecurityContext.TOKEN}
          />
        }
      />
    </BaseLayout>
  );
};

export default TokenDetailsScreen;
