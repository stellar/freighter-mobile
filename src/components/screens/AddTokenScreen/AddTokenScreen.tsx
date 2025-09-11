/* eslint-disable @typescript-eslint/no-misused-promises */
import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BigNumber from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import AddTokenBottomSheetContent from "components/screens/AddTokenScreen/AddTokenBottomSheetContent";
import CannotRemoveXlmBottomSheet from "components/screens/AddTokenScreen/CannotRemoveTokenBottomSheet";
import EmptyState from "components/screens/AddTokenScreen/EmptyState";
import ErrorState from "components/screens/AddTokenScreen/ErrorState";
import RemoveTokenBottomSheetContent from "components/screens/AddTokenScreen/RemoveTokenBottomSheet";
import TokenItem from "components/screens/AddTokenScreen/TokenItem";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { DEFAULT_BLOCKAID_SCAN_DELAY } from "config/constants";
import {
  MANAGE_TOKENS_ROUTES,
  ManageTokensStackParamList,
} from "config/routes";
import { FormattedSearchTokenRecord, HookStatus } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { getTokenIdentifier } from "helpers/balances";
import { useBlockaidToken } from "hooks/blockaid/useBlockaidToken";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageTokens } from "hooks/useManageTokens";
import { useRightHeaderButton } from "hooks/useRightHeader";
import { useTokenLookup } from "hooks/useTokenLookup";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { analytics } from "services/analytics";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTokenSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

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
  const [scannedToken, setScannedToken] = useState<
    Blockaid.TokenScanResponse | undefined
  >(undefined);
  const [isScanning, setIsScanning] = useState(false);
  const moreInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const addTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const removeTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const securityWarningBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { balanceItems, handleRefresh } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });
  const { themeColors } = useColors();

  const { searchTerm, searchResults, status, handleSearch, resetSearch } =
    useTokenLookup({
      network,
      publicKey: account?.publicKey,
      balanceItems,
    });

  const { scanToken } = useBlockaidToken();

  const securityAssessment = useMemo(
    () => assessTokenSecurity(scannedToken),
    [scannedToken],
  );
  const isTokenMalicious = securityAssessment.isMalicious;
  const isTokenSuspicious = securityAssessment.isSuspicious;

  const securitySeverity = useMemo(() => {
    if (isTokenMalicious) return SecurityLevel.MALICIOUS;
    if (isTokenSuspicious) return SecurityLevel.SUSPICIOUS;

    return undefined;
  }, [isTokenMalicious, isTokenSuspicious]);

  const securityWarnings = useMemo(() => {
    if (isTokenMalicious || isTokenSuspicious) {
      const warnings = extractSecurityWarnings(scannedToken);

      if (Array.isArray(warnings) && warnings.length > 0) {
        return warnings;
      }
    }

    return [];
  }, [isTokenMalicious, isTokenSuspicious, scannedToken]);

  const resetPageState = useCallback(() => {
    handleRefresh();
    resetSearch();
  }, [handleRefresh, resetSearch]);

  const { addToken, removeToken, isAddingToken, isRemovingToken } =
    useManageTokens({
      network,
      account,
      onSuccess: resetPageState,
    });

  useRightHeaderButton({
    onPress: () => moreInfoBottomSheetModalRef.current?.present(),
  });

  const handlePasteFromClipboard = useCallback(() => {
    getClipboardText().then(handleSearch);
  }, [getClipboardText, handleSearch]);

  const handleAddToken = useCallback(
    (token: FormattedSearchTokenRecord) => {
      setSelectedToken(token);
      setIsScanning(true);
      setScannedToken(undefined);

      scanToken(token.tokenCode, token.issuer)
        .then((scanResult) => {
          setScannedToken(scanResult);
        })
        .catch(() => {
          setScannedToken(undefined);
        })
        .finally(() => {
          setIsScanning(false);
        });

      setTimeout(() => {
        addTokenBottomSheetModalRef.current?.present();
      }, DEFAULT_BLOCKAID_SCAN_DELAY);
    },
    [scanToken],
  );

  const handleConfirmTokenAddition = useCallback(async () => {
    if (!selectedToken) {
      return;
    }

    analytics.trackAddTokenConfirmed(selectedToken.tokenCode);

    await addToken(selectedToken);

    addTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken, addToken]);

  const handleCancelTokenAddition = useCallback(() => {
    if (selectedToken) {
      analytics.trackAddTokenRejected(selectedToken.tokenCode);
    }

    addTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken]);

  const handleSecurityWarning = useCallback(() => {
    securityWarningBottomSheetModalRef.current?.present();
  }, []);

  const handleProceedAnyway = useCallback(() => {
    securityWarningBottomSheetModalRef.current?.dismiss();

    handleConfirmTokenAddition();
  }, [handleConfirmTokenAddition]);

  const handleRemoveToken = useCallback((token: FormattedSearchTokenRecord) => {
    setSelectedToken(token);
    removeTokenBottomSheetModalRef.current?.present();
  }, []);

  const handleConfirmTokenRemoval = useCallback(async () => {
    if (!selectedToken) {
      return;
    }

    analytics.trackRemoveTokenConfirmed(selectedToken.tokenCode);

    await removeToken({
      tokenRecord: selectedToken,
      tokenType: selectedToken.tokenType,
    });

    removeTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken, removeToken]);

  const handleCancelTokenRemoval = useCallback(() => {
    if (selectedToken) {
      analytics.trackRemoveTokenRejected(selectedToken.tokenCode);
    }

    removeTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken]);

  const renderRemoveBottomSheet = useCallback(() => {
    if (selectedToken && selectedToken.issuer === "XLM") {
      return (
        <CannotRemoveXlmBottomSheet
          type="native"
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
        <CannotRemoveXlmBottomSheet
          type="has-balance"
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
            issuer: selectedToken.issuer,
            tokenCode: selectedToken.tokenCode,
            tokenType: selectedToken.tokenType!,
          }}
          account={account}
          onCancel={handleCancelTokenRemoval}
          onRemoveToken={handleConfirmTokenRemoval}
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
    handleConfirmTokenRemoval,
    isRemovingToken,
    removeTokenBottomSheetModalRef,
    selectedToken,
  ]);

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
          shouldCloseOnPressBackdrop={!isScanning && !!selectedToken}
          customContent={
            <AddTokenBottomSheetContent
              token={selectedToken}
              account={account}
              onCancel={handleCancelTokenAddition}
              onAddToken={
                isTokenMalicious || isTokenSuspicious
                  ? handleSecurityWarning
                  : handleConfirmTokenAddition
              }
              proceedAnywayAction={handleConfirmTokenAddition}
              isAddingToken={isAddingToken}
              isMalicious={isTokenMalicious}
              isSuspicious={isTokenSuspicious}
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
              severity={securitySeverity}
              proceedAnywayText={t("addTokenScreen.approveAnyway")}
            />
          }
        />
        <Input
          placeholder={t("addTokenScreen.searchPlaceholder")}
          value={searchTerm}
          onChangeText={handleSearch}
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
                  handleAddToken={() => handleAddToken(token)}
                  handleRemoveToken={() => handleRemoveToken(token)}
                  isScanningToken={isScanning}
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
          lg
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
