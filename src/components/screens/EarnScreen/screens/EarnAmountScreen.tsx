import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BigNumber from "bignumber.js";
import { AmountCard } from "components/AmountCard";
import BottomSheet from "components/BottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import { PercentageButtons } from "components/PercentageButtons";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnReviewBottomSheet } from "components/screens/EarnScreen/components/EarnReviewBottomSheet";
import {
  UNKNOWN_RESOURCE_FEE_FLOOR_XLM,
  formatRate,
  getEarnCtaState,
  getPercentageDepositAmount,
  getXlmFeeShortfall,
  isInsufficientBalanceFailure,
  needsXlmForFee,
} from "components/screens/EarnScreen/helpers";
import { useEarnPosition } from "components/screens/EarnScreen/hooks/useEarnPosition";
import { useEarnTransaction } from "components/screens/EarnScreen/hooks/useEarnTransaction";
import { useSimulateEarnDeposit } from "components/screens/EarnScreen/hooks/useSimulateEarnDeposit";
import { EarnProcessingScreen } from "components/screens/EarnScreen/screens";
import { Badge } from "components/sds/Badge";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import {
  NoticeBanner,
  NoticeBannerVariants,
} from "components/sds/NoticeBanner";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  NATIVE_TOKEN_CODE,
  TransactionContext,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import {
  ADD_FUNDS_ROUTES,
  EARN_ROUTES,
  EarnStackParamList,
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useDebugStore } from "ducks/debug";
import { useEarnStore } from "ducks/earn";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import {
  calculateSpendableAmount,
  getBalanceByContractId,
} from "helpers/balances";
import {
  formatBalanceAmount,
  formatFiatInputDisplay,
  formatTokenForDisplay,
} from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInitialRecommendedFee } from "hooks/useInitialRecommendedFee";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { TextInput, View } from "react-native";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTransactionSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

type EarnAmountScreenProps = NativeStackScreenProps<
  EarnStackParamList,
  typeof EARN_ROUTES.EARN_AMOUNT_SCREEN
>;

const EarnAmountScreen: React.FC<EarnAmountScreenProps> = ({
  route,
  navigation,
}) => {
  const { assetId, tokenCode } = route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { pricedBalances } = useBalancesStore();
  const { showToast } = useToast();

  // Cross-stack navigation (Buy XLM lives outside EarnStack) needs the
  // root-level param list — the screen's own `navigation` prop is typed to
  // EarnStackParamList only. Same pattern as EarnTokenPickerScreen's Buy
  // button.
  const rootNavigation = useNavigation<NavigationProp<RootStackParamList>>();

  const pool = useEarnStore((state) => state.pool);
  const selectedAssetApy = useEarnStore((state) => state.selectedAssetApy);
  const selectedAssetDecimals = useEarnStore(
    (state) => state.selectedAssetDecimals,
  );
  const lastSubmitFailed = useEarnStore((state) => state.lastSubmitFailed);
  const setSubmitFailed = useEarnStore((state) => state.setSubmitFailed);
  const resetEarn = useEarnStore((state) => state.resetEarn);
  const { overriddenBlockaidResponse } = useDebugStore();

  const { resetTransaction } = useTransactionBuilderStore();
  const { transactionFee, transactionTimeout } = useTransactionSettingsStore();
  const { recommendedFee, networkCongestion, feePresets } = useNetworkFees();

  // Earn deposits are single-operation Soroban invokes — same shape as a
  // classic Send, so this reuses the Send fee context (and its settings
  // store) rather than introducing a dedicated Earn TransactionContext.
  useInitialRecommendedFee(
    recommendedFee,
    TransactionContext.Send,
    1,
    networkCongestion,
    feePresets,
  );

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const depositBalance = useMemo(
    () => getBalanceByContractId(assetId, pricedBalances, networkDetails),
    [assetId, pricedBalances, networkDetails],
  );

  const isXlm = useMemo(
    () =>
      !!depositBalance &&
      "token" in depositBalance &&
      "type" in depositBalance.token &&
      depositBalance.token.type === "native",
    [depositBalance],
  );

  const xlmBalance = pricedBalances[NATIVE_TOKEN_CODE];

  // Fetches the "before" side of Review's before -> after row as soon as the
  // pool/asset/account are known (well ahead of the user reaching Review),
  // and writes it to the earn duck. A failed fetch is non-fatal by design —
  // see the hook's own docs — so its return value is intentionally unused
  // here; Review reads `currentPositionTokens` off the duck directly.
  useEarnPosition({
    poolId: pool?.id ?? "",
    assetId,
    publicKey: account?.publicKey ?? "",
    networkDetails,
  });

  const amountInputRef = useRef<TextInput>(null);
  const networkFeeBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const earnReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const transactionSecurityWarningBottomSheetModalRef =
    useRef<BottomSheetModal>(null);

  const converter = useTokenFiatConverter({
    selectedBalance: depositBalance,
    tokenDecimals: selectedAssetDecimals,
  });
  const {
    tokenAmount,
    fiatAmountDisplay,
    showFiatAmount,
    setTokenAmount,
    updateFiatDisplay,
  } = converter;

  // Max/percentage buttons and the CTA's insufficient-funds guard work off
  // the plain spendable balance — nothing is held back for a Blend submit's
  // resource fee here. That fee is only known once simulation returns, and
  // is checked post-simulation instead (see `handleCtaPress`'s
  // `getXlmFeeShortfall` call), rather than guessed at and reserved upfront.
  const availableBalance = useMemo(() => {
    if (!depositBalance) {
      return "0";
    }

    return calculateSpendableAmount({
      balance: depositBalance,
      subentryCount: account?.subentryCount ?? 0,
      transactionFee,
    }).toFixed();
  }, [depositBalance, account?.subentryCount, transactionFee]);

  const availableBalanceBn = useMemo(
    () => new BigNumber(availableBalance),
    [availableBalance],
  );

  const ctaState = useMemo(
    () =>
      getEarnCtaState({
        availableBalanceIsZero: availableBalanceBn.lte(0),
        amountIsZero: new BigNumber(tokenAmount || "0").lte(0),
        isAmountTooHigh: new BigNumber(tokenAmount || "0").gt(
          availableBalanceBn,
        ),
      }),
    [availableBalanceBn, tokenAmount],
  );

  const ctaLabelKeys: Record<typeof ctaState.labelKey, string> = {
    enter: t("earnAmount.enterAmount"),
    insufficient: t("earnAmount.insufficientFunds"),
    review: t("earnAmount.review"),
  };

  const {
    simulate,
    isSimulating,
    error: simulateError,
    scanResult,
  } = useSimulateEarnDeposit();

  // `scanResult` is undefined both before any simulation has run and when the
  // scan itself was unavailable (e.g. testnet, where Blockaid throws
  // NETWORK_NOT_SUPPORTED) — `assessTransactionSecurity` already treats both
  // the same way: "unable to scan", never a clean bill of health.
  const transactionSecurityAssessment = useMemo(
    () => assessTransactionSecurity(scanResult, overriddenBlockaidResponse),
    [scanResult, overriddenBlockaidResponse],
  );

  const securityWarnings = useMemo(
    () => extractSecurityWarnings(scanResult),
    [scanResult],
  );

  const earnSecuritySeverity = useMemo(() => {
    if (transactionSecurityAssessment.isMalicious) {
      return SecurityLevel.MALICIOUS;
    }
    if (transactionSecurityAssessment.isSuspicious) {
      return SecurityLevel.SUSPICIOUS;
    }
    if (transactionSecurityAssessment.isUnableToScan) {
      return SecurityLevel.UNABLE_TO_SCAN;
    }
    return undefined;
  }, [transactionSecurityAssessment]);

  // Surface the pool's own rejection (supply cap, frozen pool, stale oracle)
  // reactively off the hook's error state — mirrors the established
  // `transactionBuilderError` toast pattern in TransactionAmountScreen.
  // Reading `error` synchronously right after `await simulate(...)` inside
  // the CTA handler would see a stale pre-update value, since a `setState`
  // scheduled inside `simulate` isn't reflected in the handler's own closure.
  const previousSimulateErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (simulateError && simulateError !== previousSimulateErrorRef.current) {
      previousSimulateErrorRef.current = simulateError;
      // A balance rejection on an XLM deposit is the fee, not the amount:
      // the CTA already gates anything above the spendable balance, so
      // what is left is a deposit that cannot also pay for itself. Every
      // other rejection — supply cap, frozen pool, stale oracle — is the
      // pool's own and reads better in its own words.
      const title =
        isXlm && isInsufficientBalanceFailure(simulateError)
          ? t("earnAmount.errors.insufficientBalanceForFee")
          : simulateError;
      showToast({
        variant: "error",
        title,
        toastId: "earn-simulate-failed",
        duration: 0,
      });
    }
  }, [simulateError, showToast, isXlm, t]);

  // Clear the "Transaction failed" retry banner once the user edits the
  // amount — but not on mount, so a banner left over from a previous failed
  // submit stays visible until an actual edit happens.
  const previousTokenAmountRef = useRef(tokenAmount);
  useEffect(() => {
    if (tokenAmount !== previousTokenAmountRef.current) {
      previousTokenAmountRef.current = tokenAmount;
      if (lastSubmitFailed) {
        setSubmitFailed(false);
      }
    }
  }, [tokenAmount, lastSubmitFailed, setSubmitFailed]);

  const handlePercentagePress = useCallback(
    (percentage: number) => {
      const targetAmount = getPercentageDepositAmount({
        maxDepositable: availableBalance,
        pct: percentage,
        decimals: selectedAssetDecimals,
      });

      if (showFiatAmount && depositBalance?.currentPrice) {
        const tokenPrice = depositBalance.currentPrice;
        if (!tokenPrice.isZero()) {
          const fiatAmount = new BigNumber(targetAmount)
            .multipliedBy(tokenPrice)
            .toFixed(2);
          updateFiatDisplay(fiatAmount);
          setTokenAmount(targetAmount);
          return;
        }
      }

      setTokenAmount(targetAmount);
    },
    [
      availableBalance,
      selectedAssetDecimals,
      showFiatAmount,
      depositBalance,
      updateFiatDisplay,
      setTokenAmount,
    ],
  );

  const openReviewSheet = useCallback(() => {
    earnReviewBottomSheetModalRef.current?.present();
  }, []);

  // `EarnProcessingScreen` is rendered INLINE below (not a registered
  // route — there is no `EARN_ROUTES.EARN_PROCESSING_SCREEN`), gated on
  // `earnTransactionStatus !== "idle"`. This structurally prevents a
  // swipe-back gesture from abandoning an in-flight submit, which is
  // stronger than a navigator's `gestureEnabled: false`.
  const {
    status: earnTransactionStatus,
    error: earnTransactionError,
    submit: submitEarnTransaction,
    reset: resetEarnTransactionStatus,
    abandon: abandonEarnTransaction,
  } = useEarnTransaction({ account, network });

  /**
   * Confirms the deposit from the review sheet. `submitEarnTransaction`
   * flips `earnTransactionStatus` to "submitting" synchronously — which is
   * what gates the inline `EarnProcessingScreen` render below — so calling
   * it both sets the processing flag and kicks off the sign/submit work.
   */
  const handleConfirmDeposit = useCallback(() => {
    submitEarnTransaction();
  }, [submitEarnTransaction]);

  // Close during "submitting": returns Home WITHOUT waiting for the result.
  // There is no background-submission infrastructure to show the outcome
  // once this screen is gone — but closing does not just hope the abandoned
  // submit is harmless: `abandonEarnTransaction()` marks it so, and
  // `useEarnTransaction`'s request-id guard (see `abandon()`'s doc there)
  // makes sure that when it eventually settles, it skips every write —
  // including the persisted `setSubmitFailed` duck flag — so it cannot
  // surface here OR corrupt a later Earn session's retry banner. This is
  // intentional, matching the flow's spec, not an oversight.
  const handleCloseEarnProcessingWhileSubmitting = useCallback(() => {
    abandonEarnTransaction();
    navigation.reset({
      index: 0,
      routes: [
        {
          // @ts-expect-error: Cross-stack navigation to MainTabStack with Home tab
          name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK,
          state: {
            routes: [{ name: MAIN_TAB_ROUTES.TAB_HOME }],
            index: 0,
          },
        },
      ],
    });
  }, [navigation, abandonEarnTransaction]);

  // Success's "Done" action: clear the earn duck (pool/asset selection,
  // lastSubmitFailed) now that the flow completed, then return Home.
  const handleEarnProcessingDone = useCallback(() => {
    resetEarn();
    navigation.reset({
      index: 0,
      routes: [
        {
          // @ts-expect-error: Cross-stack navigation to MainTabStack with Home tab
          name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK,
          state: {
            routes: [{ name: MAIN_TAB_ROUTES.TAB_HOME }],
            index: 0,
          },
        },
      ],
    });
  }, [navigation, resetEarn]);

  // Error's action: drop back to this screen (no navigation) — the retry
  // banner shows because `lastSubmitFailed` was already set by the failed
  // submit.
  const handleEarnProcessingBackToAmount = useCallback(() => {
    resetEarnTransactionStatus();
  }, [resetEarnTransactionStatus]);

  const handleCancelSecurityWarning = useCallback(() => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();
  }, []);

  // Reached only via the review sheet's banner -> detail sheet path (the
  // review sheet's OWN "Confirm anyway" button calls `handleConfirmDeposit`
  // directly and dismisses itself) — so this dismisses both sheets before
  // proceeding.
  const handleConfirmAnywayFromSecuritySheet = useCallback(() => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();
    earnReviewBottomSheetModalRef.current?.dismiss();
    handleConfirmDeposit();
  }, [handleConfirmDeposit]);

  const handleCtaPress = useCallback(async () => {
    if (ctaState.disabled) {
      return;
    }

    if (!account?.publicKey) {
      return;
    }

    // Checked AFTER the CTA's own insufficient-funds guard (above) so that
    // when the deposit asset IS XLM, an unaffordable amount reads as
    // insufficient funds on the button rather than as a fee problem. No held
    // XLM balance at all can't cover any fee, so treat that the same as
    // needing more XLM.
    const spendableXlm = xlmBalance
      ? calculateSpendableAmount({
          balance: xlmBalance,
          subentryCount: account.subentryCount,
          transactionFee,
        })
      : new BigNumber(0);

    // `transactionFee` is just the inclusion fee (~0.00001 XLM) — this gate
    // only catches "no meaningful XLM headroom at all" (e.g. no XLM held at
    // all). A Blend `submit`'s resource fee is far larger and only known once
    // simulation returns, so it is NOT folded in here as a pre-simulation
    // guess anymore — the `getXlmFeeShortfall` check below, after simulate
    // resolves, is what catches "some XLM, but not enough for the measured
    // fee". Both cases must still surface something: this sheet for the
    // former, an inline message for the latter.
    if (
      needsXlmForFee({
        spendableXlm: spendableXlm.toFixed(),
        fee: transactionFee,
      })
    ) {
      networkFeeBottomSheetModalRef.current?.present();
      return;
    }

    const result = await simulate({
      assetId,
      amount: tokenAmount,
      decimals: selectedAssetDecimals,
      transactionFee,
      transactionTimeout,
      network,
      senderAddress: account.publicKey,
    });

    if (!result) {
      // On failure, the effect above surfaces `simulateError` as a toast —
      // nothing further to do here.
      return;
    }

    // `simulate` just resolved, so the duck's `sorobanResourceFeeXlm` is now
    // the REAL, measured resource fee (never a pre-simulation guess). For an
    // XLM deposit, check whether the amount just simulated leaves enough XLM
    // to cover it.
    const { sorobanResourceFeeXlm } = useTransactionBuilderStore.getState();

    let shortfall = "0";
    if (isXlm) {
      // The backend omitted `minResourceFee` from this simulation, so the fee
      // is genuinely UNKNOWN, not zero. `tokenAmount` is already <=
      // `spendableXlm` by construction (the CTA's own `isAmountTooHigh` guard,
      // and `availableBalance === spendableXlm` for an XLM deposit), so
      // feeding "0" here would make `getXlmFeeShortfall` report "0" in every
      // case that reaches this point — silently disabling the check rather
      // than skipping it visibly, and reintroducing the exact failure this
      // whole check exists to prevent: a max-balance XLM deposit signing
      // successfully and only failing at submission. Fall back to a
      // conservative floor instead (see its doc for why "0.1" specifically)
      // — this is logged too, since it is still a gap in what simulation told
      // us, even though it is now covered rather than skipped.
      if (sorobanResourceFeeXlm === null) {
        logger.warn(
          "EarnAmountScreen",
          "sorobanResourceFeeXlm is null after a successful simulation; falling back to the unknown-fee floor for the shortfall check",
        );
      }
      shortfall = getXlmFeeShortfall({
        spendableXlm: spendableXlm.toFixed(),
        amount: tokenAmount || "0",
        resourceFee: sorobanResourceFeeXlm ?? UNKNOWN_RESOURCE_FEE_FLOOR_XLM,
      });
    }

    // INVARIANT Review and Task 13's Confirm rely on: the staged XDR in
    // `transactionBuilder` always corresponds to the currently displayed
    // `tokenAmount` by the time Review opens. This check never adjusts
    // `tokenAmount` — on a shortfall it blocks here and asks the user to
    // reduce the amount themselves, rather than correcting it and
    // re-simulating (as an earlier design did). The invariant therefore
    // holds trivially on this path: nothing changes the displayed amount
    // without a matching re-simulation, and this branch either opens Review
    // with the amount `simulate` was just called with, or doesn't open it
    // at all.
    if (new BigNumber(shortfall).gt(0)) {
      showToast({
        variant: "error",
        title: t("earnAmount.errors.feeShortfall", {
          amount: formatTokenForDisplay(shortfall),
        }),
        toastId: "earn-fee-shortfall",
        duration: 0,
      });
      return;
    }

    openReviewSheet();
  }, [
    ctaState.disabled,
    xlmBalance,
    account?.subentryCount,
    account?.publicKey,
    transactionFee,
    simulate,
    assetId,
    tokenAmount,
    selectedAssetDecimals,
    transactionTimeout,
    network,
    isXlm,
    showToast,
    t,
    openReviewSheet,
  ]);

  // Reset the builder's stale XDR/fee snapshot when the user backs out of
  // this screen without depositing. Forward navigation to Review/Processing
  // (Tasks 12/13) keeps this screen mounted underneath, so this only fires
  // on a genuine exit, not on a successful hand-off.
  useEffect(() => () => resetTransaction(), [resetTransaction]);

  // The fee-shortfall sheet's action: send the user to buy XLM rather than
  // just telling them they need it. Same destination as
  // EarnTokenPickerScreen's NotEnoughTokenBottomSheet Buy button.
  const handleBuyXlmPress = useCallback(() => {
    networkFeeBottomSheetModalRef.current?.dismiss();
    rootNavigation.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
      screen: ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN,
      params: { isUnfunded: false },
    });
  }, [rootNavigation]);

  if (earnTransactionStatus !== "idle") {
    return (
      <EarnProcessingScreen
        status={earnTransactionStatus}
        tokenAmount={tokenAmount}
        error={earnTransactionError}
        onCloseWhileSubmitting={handleCloseEarnProcessingWhileSubmitting}
        onDone={handleEarnProcessingDone}
        onBackToAmount={handleEarnProcessingBackToAmount}
      />
    );
  }

  const availableBalanceText = depositBalance
    ? `${formatBalanceAmount(depositBalance, tokenCode, availableBalanceBn)} ${t(
        "common.available",
      )}`
    : null;

  const hasUsdPrice =
    !!depositBalance?.currentPrice && !depositBalance.currentPrice.isZero();

  const secondaryAmountText = showFiatAmount
    ? formatTokenForDisplay(tokenAmount || "0", tokenCode)
    : formatFiatInputDisplay(fiatAmountDisplay || "0");

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <View className="flex-1" testID="earn-amount-screen">
        {lastSubmitFailed && (
          <View className="mb-[12px]">
            <NoticeBanner
              text={t("earnAmount.retryBanner")}
              variant={NoticeBannerVariants.ERROR}
            />
          </View>
        )}

        <AmountCard
          mode="editable"
          testID="earn-amount-card"
          label={t("earnAmount.depositLabel")}
          selectedToken={depositBalance}
          pickerLabel={tokenCode}
          onPickerPress={() => navigation.goBack()}
          pickerTestID="earn-amount-token-pill"
          inputTestID="earn-amount-input"
          focusTriggerTestID="earn-amount-focus-trigger"
          fiatToggleTestID="earn-amount-fiat-toggle"
          inputRef={amountInputRef}
          autoFocus
          accessibilityLabel={t("earnAmount.enterAmount")}
          accessibilityHint={t("earnAmount.title")}
          availableBalanceText={availableBalanceText}
          converter={converter}
          hasUsdPrice={hasUsdPrice}
          secondaryAmountText={secondaryAmountText}
        />

        <View className="flex-row items-center justify-center gap-[6px] mt-[20px]">
          <Text sm secondary medium>
            {t("earnAmount.apyLabel")}
          </Text>
          <Badge
            variant={selectedAssetApy === null ? "secondary" : "success"}
            size="sm"
          >
            {formatRate(selectedAssetApy)}
          </Badge>
        </View>

        <View className="items-center mt-[24px]">
          <PercentageButtons
            onPress={handlePercentagePress}
            testID="earn-amount-percentage-buttons"
          />
        </View>
      </View>

      <View className="w-full mt-auto mb-[8px]">
        <Button
          tertiary
          xl
          onPress={handleCtaPress}
          disabled={ctaState.disabled}
          isLoading={isSimulating}
          testID="earn-amount-cta"
        >
          {ctaLabelKeys[ctaState.labelKey]}
        </Button>
      </View>

      <BottomSheet
        modalRef={networkFeeBottomSheetModalRef}
        handleCloseModal={() =>
          networkFeeBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <InformationBottomSheet
            title={t("earnAmount.networkFeeSheet.title")}
            onClose={() => networkFeeBottomSheetModalRef.current?.dismiss()}
            onConfirm={handleBuyXlmPress}
            confirmLabel={t("earnAmount.networkFeeSheet.buyXlm")}
            headerElement={
              <View className="bg-amber-3 p-2 rounded-[8px]">
                <Icon.InfoOctagon
                  color={themeColors.status.warning}
                  size={28}
                />
              </View>
            }
            texts={[
              {
                key: "description",
                value: t("earnAmount.networkFeeSheet.description", {
                  fee: formatTokenForDisplay(transactionFee, NATIVE_TOKEN_CODE),
                }),
              },
            ]}
          />
        }
      />

      <BottomSheet
        modalRef={earnReviewBottomSheetModalRef}
        handleCloseModal={() =>
          earnReviewBottomSheetModalRef.current?.dismiss()
        }
        analyticsEvent={AnalyticsEvent.VIEW_EARN_REVIEW}
        customContent={
          <EarnReviewBottomSheet
            bottomSheetModalRef={earnReviewBottomSheetModalRef}
            tokenAmount={tokenAmount}
            transactionSecurityAssessment={transactionSecurityAssessment}
            onSecurityWarningPress={() =>
              transactionSecurityWarningBottomSheetModalRef.current?.present()
            }
            onConfirm={handleConfirmDeposit}
          />
        }
      />
      <BottomSheet
        modalRef={transactionSecurityWarningBottomSheetModalRef}
        handleCloseModal={handleCancelSecurityWarning}
        customContent={
          <SecurityDetailBottomSheet
            warnings={securityWarnings}
            onCancel={handleCancelSecurityWarning}
            onProceedAnyway={handleConfirmAnywayFromSecuritySheet}
            onClose={handleCancelSecurityWarning}
            severity={earnSecuritySeverity}
            proceedAnywayText={
              transactionSecurityAssessment.isUnableToScan
                ? t("common.continue")
                : t("transactionAmountScreen.confirmAnyway")
            }
          />
        }
      />
    </BaseLayout>
  );
};

export default EarnAmountScreen;
