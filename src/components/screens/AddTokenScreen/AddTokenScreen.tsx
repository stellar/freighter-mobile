/* eslint-disable @typescript-eslint/no-misused-promises */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BigNumber from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import AddTokenBottomSheetContent from "components/screens/AddTokenScreen/AddTokenBottomSheetContent";
import CannotRemoveTokenBottomSheet, {
  CannotRemoveType,
} from "components/screens/AddTokenScreen/CannotRemoveTokenBottomSheet";
import EmptyState from "components/screens/AddTokenScreen/EmptyState";
import ErrorState from "components/screens/AddTokenScreen/ErrorState";
import RemoveTokenBottomSheetContent from "components/screens/AddTokenScreen/RemoveTokenBottomSheet";
import TokenItem from "components/screens/AddTokenScreen/TokenItem";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  MANAGE_TOKENS_ROUTES,
  ManageTokensStackParamList,
} from "config/routes";
import { FormattedSearchTokenRecord, HookStatus } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { getTokenIdentifier } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useDebounce from "hooks/useDebounce";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageToken } from "hooks/useManageToken";
import { useRightHeaderButton } from "hooks/useRightHeader";
import { useTokenLookup } from "hooks/useTokenLookup";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { analytics } from "services/analytics";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";
import { createSecurityAssessment } from "services/blockaid/helper";

type AddTokenScreenProps = NativeStackScreenProps<
  ManageTokensStackParamList,
  typeof MANAGE_TOKENS_ROUTES.ADD_TOKEN_SCREEN
>;

const AddTokenScreen: React.FC<AddTokenScreenProps> = () => {
  const { network } = useAuthenticationStore();
  const { account } = useGetActiveAccount();
  const { t } = useAppTranslation();
  const { getClipboardText } = useClipboard();
  const [selectedToken, setSelectedToken] =
    useState<FormattedSearchTokenRecord | null>(null);
  const [scannedToken, setScannedToken] = useState(
    createSecurityAssessment(SecurityLevel.SAFE),
  );
  const moreInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const addTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const removeTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const securityWarningBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { balanceItems, handleRefresh } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });
  const { themeColors } = useColors();

  const [searchTerm, setSearchTerm] = useState("");
  const { searchResults, status, handleSearch, resetSearch } = useTokenLookup({
    network,
    publicKey: account?.publicKey,
    balanceItems,
  });

  const isTokenMalicious = scannedToken.isMalicious;
  const isTokenSuspicious = scannedToken.isSuspicious;
  const isUnableToScanToken =
    scannedToken.level === SecurityLevel.UNABLE_TO_SCAN;

  // Generate security warnings from the scanned token assessment
  const securityWarnings = useMemo(() => {
    if (isUnableToScanToken) {
      // For "Unable to scan" cases, always provide a warning so the list renders
      return [
        {
          id: "unable-to-scan",
          description:
            scannedToken.details || t("blockaid.addTokenUnableToScan.reason"),
        },
      ];
    }

    // For other cases, use the warnings from the selected token
    return selectedToken?.securityWarnings || [];
  }, [
    isUnableToScanToken,
    scannedToken.details,
    selectedToken?.securityWarnings,
    t,
  ]);

  const securitySeverity = useMemo(() => {
    if (isTokenMalicious) return SecurityLevel.MALICIOUS;
    if (isTokenSuspicious) return SecurityLevel.SUSPICIOUS;
    if (isUnableToScanToken) return SecurityLevel.UNABLE_TO_SCAN;

    return undefined;
  }, [isTokenMalicious, isTokenSuspicious, isUnableToScanToken]);

  const resetPageState = useCallback(() => {
    handleRefresh();
    resetSearch();
  }, [handleRefresh, resetSearch]);

  const { addToken, removeToken, isAddingToken, isRemovingToken } =
    useManageToken({
      token: selectedToken
        ? {
            type: selectedToken.tokenType,
            code: selectedToken.tokenCode,
            issuer: selectedToken.issuer,
            decimals: selectedToken.decimals,
            name: selectedToken.name,
          }
        : null,
      network,
      account,
      onSuccess: resetPageState,
      bottomSheetRefAdd: addTokenBottomSheetModalRef,
      bottomSheetRefRemove: removeTokenBottomSheetModalRef,
    });

  useRightHeaderButton({
    onPress: () => moreInfoBottomSheetModalRef.current?.present(),
  });

  const handlePasteFromClipboard = useCallback(() => {
    getClipboardText().then(handleSearch);
  }, [getClipboardText, handleSearch]);

  const handleAddToken = useCallback((token: FormattedSearchTokenRecord) => {
    setSelectedToken(token);
    setScannedToken({
      isMalicious: token?.isMalicious || false,
      isSuspicious: token?.isSuspicious || false,
      level: token?.securityLevel || SecurityLevel.SAFE,
    });

    // If token is unable to scan, show security warning first
    if (token?.securityLevel === SecurityLevel.UNABLE_TO_SCAN) {
      securityWarningBottomSheetModalRef.current?.present();
    } else {
      // For malicious, suspicious, and safe tokens, go directly to AddTokenBottomSheet
      addTokenBottomSheetModalRef.current?.present();
    }
  }, []);

  const handleCancelTokenAddition = useCallback(() => {
    if (selectedToken) {
      analytics.trackAddTokenRejected(selectedToken.tokenCode);
    }

    addTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken]);

  const handleProceedAnyway = useCallback(() => {
    securityWarningBottomSheetModalRef.current?.dismiss();

    // If it's unable to scan, show the AddTokenBottomSheetContent with banner
    if (isUnableToScanToken) {
      addTokenBottomSheetModalRef.current?.present();
    } else {
      addToken();
    }
  }, [addToken, isUnableToScanToken]);

  const handleSecurityWarningPress = useCallback(() => {
    addTokenBottomSheetModalRef.current?.dismiss();
    securityWarningBottomSheetModalRef.current?.present();
  }, []);

  const handleRemoveToken = useCallback((token: FormattedSearchTokenRecord) => {
    setSelectedToken(token);
    removeTokenBottomSheetModalRef.current?.present();
  }, []);

  const handleCancelTokenRemoval = useCallback(() => {
    if (selectedToken) {
      analytics.trackRemoveTokenRejected(selectedToken.tokenCode);
    }

    removeTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken]);

  const renderRemoveBottomSheet = useCallback(() => {
    if (selectedToken && selectedToken.issuer === "XLM") {
      return (
        <CannotRemoveTokenBottomSheet
          type={CannotRemoveType.native}
          onDismiss={() => {
            removeTokenBottomSheetModalRef.current?.dismiss();
          }}
        />
      );
    }

    const tokenBalance = balanceItems.find(
      (balance) =>
        getTokenIdentifier(balance) ===
        `${selectedToken?.tokenCode}:${selectedToken?.issuer}`,
    );
    const hasBalance =
      tokenBalance && tokenBalance.total.isGreaterThan(new BigNumber(0));

    if (hasBalance) {
      return (
        <CannotRemoveTokenBottomSheet
          type={CannotRemoveType.hasBalance}
          onDismiss={() => {
            removeTokenBottomSheetModalRef.current?.dismiss();
          }}
        />
      );
    }

    if (selectedToken) {
      return (
        <RemoveTokenBottomSheetContent
          token={{
            domain: selectedToken.domain,
            issuer: selectedToken.issuer,
            tokenCode: selectedToken.tokenCode,
            tokenType: selectedToken.tokenType!,
          }}
          account={account}
          onCancel={handleCancelTokenRemoval}
          onRemoveToken={removeToken}
          isRemovingToken={isRemovingToken}
        />
      );
    }

    /* eslint-disable react/jsx-no-useless-fragment */
    return <></>;
    /* eslint-enable react/jsx-no-useless-fragment */
  }, [
    account,
    balanceItems,
    handleCancelTokenRemoval,
    removeToken,
    isRemovingToken,
    removeTokenBottomSheetModalRef,
    selectedToken,
  ]);

  const debouncedHandleSearch = useDebounce((text: string) => {
    handleSearch(text);
  }, 200);

  const handleAddTokenMemo = useCallback(
    (token: FormattedSearchTokenRecord) => handleAddToken(token),
    [handleAddToken],
  );

  const handleRemoveTokenMemo = useCallback(
    (token: FormattedSearchTokenRecord) => handleRemoveToken(token),
    [handleRemoveToken],
  );

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <BottomSheet
          modalRef={moreInfoBottomSheetModalRef}
          customContent={
            <View className="gap-4">
              <View className="flex-row justify-between items-center">
                <View className="size-10 rounded-lg items-center justify-center bg-lilac-3 border border-lilac-6">
                  <Icon.Coins01 themeColor="lilac" />
                </View>
                <TouchableOpacity
                  onPress={() => moreInfoBottomSheetModalRef.current?.dismiss()}
                  className="size-10 items-center justify-center rounded-full bg-gray-3"
                >
                  <Icon.X color={themeColors.gray[9]} />
                </TouchableOpacity>
              </View>
              <View>
                <Text xl medium>
                  {t("manageTokensScreen.moreInfo.title")}
                </Text>
                <View className="h-4" />
                <Text md medium secondary>
                  {t("manageTokensScreen.moreInfo.block1")}
                </Text>
                <View className="h-4" />
                <Text md medium secondary>
                  {t("manageTokensScreen.moreInfo.block2")}
                </Text>
              </View>
            </View>
          }
          handleCloseModal={() =>
            moreInfoBottomSheetModalRef.current?.dismiss()
          }
        />
        <BottomSheet
          modalRef={addTokenBottomSheetModalRef}
          handleCloseModal={() => {
            addTokenBottomSheetModalRef.current?.dismiss();
          }}
          analyticsEvent={AnalyticsEvent.VIEW_ADD_TOKEN_MANUALLY}
          shouldCloseOnPressBackdrop={!!selectedToken}
          customContent={
            <AddTokenBottomSheetContent
              token={selectedToken}
              account={account}
              onCancel={handleCancelTokenAddition}
              onAddToken={addToken}
              proceedAnywayAction={addToken}
              isAddingToken={isAddingToken}
              isMalicious={isTokenMalicious}
              isSuspicious={isTokenSuspicious}
              isUnableToScanToken={isUnableToScanToken}
              onSecurityWarningPress={handleSecurityWarningPress}
            />
          }
        />
        <BottomSheet
          modalRef={removeTokenBottomSheetModalRef}
          handleCloseModal={() => {
            removeTokenBottomSheetModalRef.current?.dismiss();
          }}
          analyticsEvent={AnalyticsEvent.VIEW_REMOVE_TOKEN}
          shouldCloseOnPressBackdrop={!!selectedToken}
          customContent={renderRemoveBottomSheet()}
        />
        <BottomSheet
          modalRef={securityWarningBottomSheetModalRef}
          handleCloseModal={() =>
            securityWarningBottomSheetModalRef.current?.dismiss()
          }
          customContent={
            <SecurityDetailBottomSheet
              warnings={securityWarnings}
              onCancel={() =>
                securityWarningBottomSheetModalRef.current?.dismiss()
              }
              onProceedAnyway={handleProceedAnyway}
              onClose={() =>
                securityWarningBottomSheetModalRef.current?.dismiss()
              }
              severity={
                securitySeverity as Exclude<SecurityLevel, SecurityLevel.SAFE>
              }
              securityContext={SecurityContext.TOKEN}
              proceedAnywayText={
                isUnableToScanToken
                  ? t("common.continue")
                  : t("addTokenScreen.approveAnyway")
              }
            />
          }
        />
        <Input
          placeholder={t("addTokenScreen.searchPlaceholder")}
          value={searchTerm}
          onChangeText={(text: string) => {
            setSearchTerm(text);
            debouncedHandleSearch(text);
          }}
          fieldSize="lg"
          autoCapitalize="none"
          autoCorrect={false}
          leftElement={
            <Icon.SearchMd size={16} color={themeColors.foreground.primary} />
          }
        />
        <View className="h-4" />
        {status === HookStatus.LOADING && <Spinner />}
        {status === HookStatus.SUCCESS && (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            {searchResults.length > 0 ? (
              searchResults.map((token) => (
                <TokenItem
                  key={`${token.tokenCode}:${token.issuer}`}
                  token={token}
                  handleAddToken={handleAddTokenMemo}
                  handleRemoveToken={handleRemoveTokenMemo}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </ScrollView>
        )}
        {status === HookStatus.ERROR && <ErrorState />}
        <View className="h-4" />
        <Button
          secondary
          testID="paste-from-clipboard-button"
          onPress={handlePasteFromClipboard}
          icon={
            <Icon.Clipboard size={16} color={themeColors.foreground.primary} />
          }
        >
          {t("addTokenScreen.pasteFromClipboard")}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default AddTokenScreen;
