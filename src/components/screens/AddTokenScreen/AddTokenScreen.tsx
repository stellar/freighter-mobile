/* eslint-disable @typescript-eslint/no-misused-promises */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BigNumber from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import HiddenItemsSheetContent, {
  HiddenItem,
} from "components/HiddenItemsSheetContent";
import Spinner from "components/Spinner";
import { TokenIcon } from "components/TokenIcon";
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
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  MANAGE_TOKENS_ROUTES,
  ManageTokensStackParamList,
} from "config/routes";
import {
  FormattedSearchTokenRecord,
  HookStatus,
  TokenTypeWithCustomToken,
} from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { getTokenIdentifier } from "helpers/balances";
import {
  getSearchTokenRecordId,
  shouldOfferUnhide,
} from "helpers/hiddenTokens";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useDebounce from "hooks/useDebounce";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageToken } from "hooks/useManageToken";
import { useRightHeaderButton } from "hooks/useRightHeader";
import { useTokenLookup } from "hooks/useTokenLookup";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { analytics } from "services/analytics";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";
import {
  createSecurityAssessment,
  SecurityWarning,
} from "services/blockaid/helper";

type AddTokenScreenProps = NativeStackScreenProps<
  ManageTokensStackParamList,
  typeof MANAGE_TOKENS_ROUTES.ADD_TOKEN_SCREEN
>;

const DEBOUNCE_SEARCH_BACKOFF_MS = 500;

const AddTokenScreen: React.FC<AddTokenScreenProps> = ({ navigation }) => {
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
  const hiddenTokensBottomSheetModalRef = useRef<BottomSheetModal>(null);
  // Hidden tokens stay in `balanceItems` here: the search still needs to know
  // the account holds them, so a hidden token's row offers Unhide, not Add.
  const { balanceItems, hiddenBalanceItems, handleRefresh } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    includeHidden: true,
  });
  const hiddenTokenIds = useBalancesStore((state) => state.hiddenTokenIds);
  const unhideToken = useBalancesStore((state) => state.unhideToken);
  const { showToast } = useToast();
  const [unhidingTokenId, setUnhidingTokenId] = useState<string | null>(null);
  const { themeColors } = useColors();

  const [searchTerm, setSearchTerm] = useState("");
  const {
    searchResults,
    verifiedTokens,
    unverifiedTokens,
    status,
    handleSearch,
    resetSearch,
  } = useTokenLookup({
    network,
    publicKey: account?.publicKey,
    balanceItems,
  });

  const hasUnableToScanTokens = useMemo(
    () => searchResults.some((token) => token.isUnableToScan),
    [searchResults],
  );

  const isTokenMalicious = scannedToken.isMalicious;
  const isTokenSuspicious = scannedToken.isSuspicious;
  const isUnableToScanToken = scannedToken.isUnableToScan;

  const securityWarnings = useMemo<SecurityWarning[]>(() => {
    if (isUnableToScanToken) {
      return [
        {
          id: "unable-to-scan",
          description: scannedToken.details || t("blockaid.unableToScan.token"),
          severity: "warning",
        },
      ];
    }

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
    setSearchTerm("");
  }, [handleRefresh, resetSearch]);

  const handleManageTokenSuccess = useCallback(() => {
    resetPageState();
    navigation.goBack();
  }, [resetPageState, navigation]);

  const { addToken, removeToken, isAddingToken, isRemovingToken } =
    useManageToken({
      token: selectedToken
        ? {
            type: selectedToken.tokenType,
            code: selectedToken.tokenCode,
            issuer: selectedToken.issuer,
            decimals: selectedToken.decimals,
            name: selectedToken.name,
            iconUrl: selectedToken.iconUrl,
          }
        : null,
      network,
      account,
      onSuccess: handleManageTokenSuccess,
      bottomSheetRefAdd: addTokenBottomSheetModalRef,
      bottomSheetRefRemove: removeTokenBottomSheetModalRef,
    });

  useRightHeaderButton({
    onPress: () => moreInfoBottomSheetModalRef.current?.present(),
  });

  const handlePasteFromClipboard = useCallback(() => {
    getClipboardText().then((text) => {
      setSearchTerm(text);
      handleSearch(text);
    });
  }, [getClipboardText, handleSearch]);

  const handleAddToken = useCallback((token: FormattedSearchTokenRecord) => {
    setSelectedToken(token);
    setScannedToken({
      isMalicious: token?.isMalicious || false,
      isSuspicious: token?.isSuspicious || false,
      isUnableToScan: token?.isUnableToScan || false,
      level: token?.securityLevel || SecurityLevel.SAFE,
    });

    if (token?.isUnableToScan) {
      securityWarningBottomSheetModalRef.current?.present();
    } else {
      addTokenBottomSheetModalRef.current?.present();
    }
  }, []);

  // A custom token is stored locally and never signs, so its prompt reports no
  // signing outcome. Every other token adds or removes a trustline, which does.
  const promptSigns = selectedToken
    ? selectedToken.tokenType !== TokenTypeWithCustomToken.CUSTOM_TOKEN
    : false;

  // The removal prompt shows a "cannot remove" message for XLM and for a token
  // that still holds a balance. Those messages offer no signing decision, so
  // leaving one is not a rejection.
  const canRemoveTrustline = useMemo(() => {
    if (!selectedToken || selectedToken.isNative) {
      return false;
    }

    const tokenBalance = balanceItems.find(
      (balance) =>
        getTokenIdentifier(balance) ===
        `${selectedToken.tokenCode}:${selectedToken.issuer}`,
    );

    return !tokenBalance?.total.isGreaterThan(new BigNumber(0));
  }, [balanceItems, selectedToken]);

  // True once the user approves. Cleared as each sheet opens, because a
  // dismissal does not always run.
  const hasApprovedAddRef = useRef(false);
  const hasApprovedRemoveRef = useRef(false);

  // True while one sheet closes to open another sheet of the same attempt.
  // The add prompt and the security detail prompt hand off to each other, and
  // that hand-off is not a decision.
  const isSheetHandoffRef = useRef(false);

  /**
   * Reports a rejection when the user leaves a trustline prompt without
   * approving, by any route.
   */
  const reportDismissal = (
    approved: React.MutableRefObject<boolean>,
    signs: boolean,
  ) => {
    if (isSheetHandoffRef.current) {
      isSheetHandoffRef.current = false;
      return;
    }
    if (approved.current || !signs) {
      return;
    }
    analytics.trackInternalSignedTransactionRejected();
  };

  const handleCancelTokenAddition = useCallback(() => {
    if (selectedToken) {
      analytics.trackAddTokenRejected(selectedToken.tokenCode);
    }

    addTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken]);

  const handleProceedAnyway = useCallback(() => {
    // The user either returns to the add prompt or approves here. Both end the
    // security detail prompt without a rejection.
    if (isUnableToScanToken) {
      isSheetHandoffRef.current = true;
    } else {
      hasApprovedAddRef.current = true;
    }

    securityWarningBottomSheetModalRef.current?.dismiss();

    // If it's unable to scan, show the AddTokenBottomSheetContent with banner
    if (isUnableToScanToken) {
      addTokenBottomSheetModalRef.current?.present();
    } else {
      addToken();
    }
  }, [addToken, isUnableToScanToken]);

  const handleSecurityWarningPress = useCallback(() => {
    // The add prompt hands the same attempt to the security detail prompt.
    isSheetHandoffRef.current = true;
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
    // `canRemoveTrustline` decides this branch, so the prompt the user sees and
    // the outcome the wallet reports always agree.
    if (selectedToken && !canRemoveTrustline) {
      return (
        <CannotRemoveTokenBottomSheet
          type={
            selectedToken.isNative
              ? CannotRemoveType.native
              : CannotRemoveType.hasBalance
          }
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
          onRemoveToken={() => {
            hasApprovedRemoveRef.current = true;
            return removeToken();
          }}
          isRemovingToken={isRemovingToken}
        />
      );
    }

    /* eslint-disable react/jsx-no-useless-fragment */
    return <></>;
    /* eslint-enable react/jsx-no-useless-fragment */
  }, [
    account,
    canRemoveTrustline,
    handleCancelTokenRemoval,
    removeToken,
    isRemovingToken,
    removeTokenBottomSheetModalRef,
    selectedToken,
  ]);

  const debouncedHandleSearch = useDebounce((text: string) => {
    handleSearch(text);
  }, DEBOUNCE_SEARCH_BACKOFF_MS);

  const handleAddTokenMemo = useCallback(
    (token: FormattedSearchTokenRecord) => handleAddToken(token),
    [handleAddToken],
  );

  const handleRemoveTokenMemo = useCallback(
    (token: FormattedSearchTokenRecord) => handleRemoveToken(token),
    [handleRemoveToken],
  );

  /**
   * Unhides a token from the hidden-tokens sheet or a search row, then
   * confirms with a toast. The sheet stays open so several tokens can be
   * unhidden in a row.
   */
  const handleUnhideToken = useCallback(
    async ({ tokenId, tokenCode }: { tokenId: string; tokenCode: string }) => {
      const publicKey = account?.publicKey;

      if (!publicKey || unhidingTokenId) {
        return;
      }

      setUnhidingTokenId(tokenId);

      try {
        await unhideToken({ publicKey, network, tokenId });
        showToast({
          title: t("hiddenTokens.unhidden", { tokenCode }),
          variant: "success",
          toastId: "unhide-token-toast",
        });
      } catch {
        showToast({
          title: t("hiddenTokens.unhideError", { tokenCode }),
          variant: "error",
          toastId: "unhide-token-toast",
        });
      } finally {
        setUnhidingTokenId(null);
      }
    },
    [account?.publicKey, unhidingTokenId, unhideToken, network, showToast, t],
  );

  const handleUnhideSearchToken = useCallback(
    (token: FormattedSearchTokenRecord) =>
      handleUnhideToken({
        tokenId: getSearchTokenRecordId(token),
        tokenCode: token.tokenCode,
      }),
    [handleUnhideToken],
  );

  // Flag hidden tokens at render time (not inside the lookup) so a row flips
  // back to the regular menu the moment the token is unhidden.
  const flagHiddenTokens = useCallback(
    (tokens: FormattedSearchTokenRecord[]) =>
      tokens.map((token) => ({
        ...token,
        isHidden: shouldOfferUnhide(token, hiddenTokenIds),
      })),
    [hiddenTokenIds],
  );

  const verifiedTokensWithHidden = useMemo(
    () => flagHiddenTokens(verifiedTokens),
    [flagHiddenTokens, verifiedTokens],
  );

  const unverifiedTokensWithHidden = useMemo(
    () => flagHiddenTokens(unverifiedTokens),
    [flagHiddenTokens, unverifiedTokens],
  );

  const hiddenItems = useMemo<HiddenItem[]>(
    () =>
      hiddenBalanceItems.map((item) => ({
        id: item.id,
        leading: <TokenIcon token={item} />,
        title: item.tokenCode ?? item.id,
        subtitle:
          item.displayName && item.displayName !== item.tokenCode
            ? item.displayName
            : undefined,
        isUnhiding: unhidingTokenId === item.id,
        onUnhide: () =>
          handleUnhideToken({
            tokenId: item.id,
            tokenCode: item.tokenCode ?? item.id,
          }),
      })),
    [hiddenBalanceItems, unhidingTokenId, handleUnhideToken],
  );

  // Only before the user starts searching: once there is a query, a hidden
  // token that matches shows Unhide on its own row instead.
  const isSearchEmpty = searchTerm.trim() === "";

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
                <Text md regular secondary>
                  {t("manageTokensScreen.moreInfo.block1")}
                </Text>
                <View className="h-4" />
                <Text md regular secondary>
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
          bottomSheetModalProps={{
            onChange: (index: number) => {
              if (index >= 0) {
                hasApprovedAddRef.current = false;
              }
            },
            onDismiss: () => reportDismissal(hasApprovedAddRef, promptSigns),
          }}
          analyticsEvent={AnalyticsEvent.VIEW_ADD_TOKEN_MANUALLY}
          shouldCloseOnPressBackdrop={!!selectedToken}
          customContent={
            <AddTokenBottomSheetContent
              token={selectedToken}
              account={account}
              onCancel={handleCancelTokenAddition}
              onAddToken={() => {
                hasApprovedAddRef.current = true;
                return addToken();
              }}
              proceedAnywayAction={() => {
                hasApprovedAddRef.current = true;
                return addToken();
              }}
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
          bottomSheetModalProps={{
            onChange: (index: number) => {
              if (index >= 0) {
                hasApprovedRemoveRef.current = false;
              }
            },
            onDismiss: () =>
              reportDismissal(
                hasApprovedRemoveRef,
                promptSigns && canRemoveTrustline,
              ),
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
          bottomSheetModalProps={{
            onChange: (index: number) => {
              if (index >= 0) {
                hasApprovedAddRef.current = false;
              }
            },
            // This prompt is the last step of an add attempt that carries a
            // security warning. Leaving it without approval is a rejection.
            onDismiss: () => reportDismissal(hasApprovedAddRef, promptSigns),
          }}
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
              securityContext={SecurityContext.TOKEN}
              proceedAnywayText={
                isUnableToScanToken
                  ? t("common.continue")
                  : t("addTokenScreen.approveAnyway")
              }
            />
          }
        />
        <BottomSheet
          modalRef={hiddenTokensBottomSheetModalRef}
          // Lets drags scroll a long hidden list instead of moving the sheet
          enableContentPanningGesture={false}
          handleCloseModal={() =>
            hiddenTokensBottomSheetModalRef.current?.dismiss()
          }
          customContent={
            <HiddenItemsSheetContent
              title={t("hiddenTokens.title")}
              emptyText={t("hiddenTokens.empty")}
              items={hiddenItems}
              onClose={() => hiddenTokensBottomSheetModalRef.current?.dismiss()}
              testID="hidden-tokens-sheet"
            />
          }
        />
        {/* Keep the search and its Show hidden link together at the top; the
            screen's space-between layout would otherwise float the link. */}
        <View>
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
          {isSearchEmpty && (
            <View className="self-end mt-4">
              <TextButton
                testID="add-token-show-hidden"
                text={t("hiddenTokens.showHidden")}
                variant="tertiary"
                className="py-1"
                hitSlop={{ top: 6, bottom: 6 }}
                onPress={() =>
                  hiddenTokensBottomSheetModalRef.current?.present()
                }
              />
            </View>
          )}
        </View>
        {status === HookStatus.LOADING && <Spinner />}
        {status === HookStatus.SUCCESS && (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            {searchResults.length > 0 ? (
              <>
                {hasUnableToScanTokens && (
                  <View className="mb-4 mt-4 p-4 bg-gray-3 rounded-[16px] flex-row items-center gap-2">
                    <Icon.Cube01 size={16} color={themeColors.gray[11]} />
                    <Text md color={themeColors.gray[11]}>
                      {t("addTokenScreen.unableToScanBanner")}
                    </Text>
                  </View>
                )}
                {verifiedTokens.length > 0 && (
                  <>
                    <TouchableOpacity
                      className="mt-4 mb-6 flex-row items-center gap-2 self-start"
                      hitSlop={10}
                      onPress={() =>
                        moreInfoBottomSheetModalRef.current?.present()
                      }
                    >
                      <Text md medium secondary>
                        {t("addTokenScreen.verified")}
                      </Text>
                      <Icon.InfoCircle
                        size={16}
                        color={themeColors.foreground.secondary}
                      />
                    </TouchableOpacity>
                    {verifiedTokensWithHidden.map((token) => (
                      <TokenItem
                        key={`${token.tokenCode}:${token.issuer}`}
                        token={token}
                        handleAddToken={handleAddTokenMemo}
                        handleRemoveToken={handleRemoveTokenMemo}
                        handleUnhideToken={handleUnhideSearchToken}
                        isUnhiding={
                          unhidingTokenId === getSearchTokenRecordId(token)
                        }
                      />
                    ))}
                  </>
                )}
                {unverifiedTokens.length > 0 && (
                  <>
                    <TouchableOpacity
                      className="mt-4 mb-6 flex-row items-center gap-2 self-start"
                      hitSlop={10}
                      onPress={() =>
                        moreInfoBottomSheetModalRef.current?.present()
                      }
                    >
                      <Text md medium secondary>
                        {t("addTokenScreen.unverified")}
                      </Text>
                      <Icon.InfoCircle
                        size={16}
                        color={themeColors.foreground.secondary}
                      />
                    </TouchableOpacity>
                    {unverifiedTokensWithHidden.map((token) => (
                      <TokenItem
                        key={`${token.tokenCode}:${token.issuer}`}
                        token={token}
                        handleAddToken={handleAddTokenMemo}
                        handleRemoveToken={handleRemoveTokenMemo}
                        handleUnhideToken={handleUnhideSearchToken}
                        isUnhiding={
                          unhidingTokenId === getSearchTokenRecordId(token)
                        }
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              <EmptyState />
            )}
          </ScrollView>
        )}
        {status === HookStatus.ERROR && <ErrorState />}
        <View className="h-4" />
        <Button
          tertiary
          testID="paste-from-clipboard-button"
          onPress={handlePasteFromClipboard}
          icon={<Icon.Clipboard size={16} />}
        >
          {t("addTokenScreen.pasteFromClipboard")}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default AddTokenScreen;
