import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BigNumber from "bignumber.js";
import { AmountCard } from "components/AmountCard";
import BottomSheet from "components/BottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import { PercentageButtons } from "components/PercentageButtons";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  formatRate,
  getEarnCtaState,
  getMaxDepositAmount,
  getPercentageDepositAmount,
  needsXlmForFee,
} from "components/screens/EarnScreen/helpers";
import { useSimulateEarnDeposit } from "components/screens/EarnScreen/hooks/useSimulateEarnDeposit";
import { Badge } from "components/sds/Badge";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import {
  NoticeBanner,
  NoticeBannerVariants,
} from "components/sds/NoticeBanner";
import { Text } from "components/sds/Typography";
import {
  NATIVE_TOKEN_CODE,
  TransactionContext,
  mapNetworkToNetworkDetails,
} from "config/constants";
import {
  ADD_FUNDS_ROUTES,
  EARN_ROUTES,
  EarnStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
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

type EarnAmountScreenProps = NativeStackScreenProps<
  EarnStackParamList,
  typeof EARN_ROUTES.EARN_AMOUNT_SCREEN
>;

const EarnAmountScreen: React.FC<EarnAmountScreenProps> = ({ route }) => {
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

  const selectedAssetApy = useEarnStore((state) => state.selectedAssetApy);
  const selectedAssetDecimals = useEarnStore(
    (state) => state.selectedAssetDecimals,
  );
  const lastSubmitFailed = useEarnStore((state) => state.lastSubmitFailed);
  const setSubmitFailed = useEarnStore((state) => state.setSubmitFailed);

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

  const amountInputRef = useRef<TextInput>(null);
  const networkFeeBottomSheetModalRef = useRef<BottomSheetModal>(null);

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

  const maxDepositable = useMemo(() => {
    if (!depositBalance) {
      return "0";
    }

    const spendable = calculateSpendableAmount({
      balance: depositBalance,
      subentryCount: account?.subentryCount ?? 0,
      transactionFee,
    });

    return getMaxDepositAmount({
      availableBalance: spendable.toFixed(),
      isXlm,
    });
  }, [depositBalance, account?.subentryCount, transactionFee, isXlm]);

  const maxDepositableBn = useMemo(
    () => new BigNumber(maxDepositable),
    [maxDepositable],
  );

  const ctaState = useMemo(
    () =>
      getEarnCtaState({
        availableBalanceIsZero: maxDepositableBn.lte(0),
        amountIsZero: new BigNumber(tokenAmount || "0").lte(0),
        isAmountTooHigh: new BigNumber(tokenAmount || "0").gt(maxDepositableBn),
      }),
    [maxDepositableBn, tokenAmount],
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
  } = useSimulateEarnDeposit();

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
      showToast({
        variant: "error",
        title: simulateError,
        toastId: "earn-simulate-failed",
        duration: 0,
      });
    }
  }, [simulateError, showToast]);

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
        maxDepositable,
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
      maxDepositable,
      selectedAssetDecimals,
      showFiatAmount,
      depositBalance,
      updateFiatDisplay,
      setTokenAmount,
    ],
  );

  /**
   * Placeholder for Task 12, which builds `EarnReviewBottomSheet` and a
   * `useEarnPosition` hook and wires this to present the review sheet with
   * the prepared XDR / scan result `simulate` just resolved. Named now so
   * the CTA's order-of-operations (fee check → simulate → open review) is
   * already settled by the time Task 12 fills this in.
   */
  const openReviewSheet = useCallback(() => {
    // TODO(Task 12): present EarnReviewBottomSheet.
  }, []);

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

    if (result) {
      openReviewSheet();
    }
    // On failure, the effect above surfaces `simulateError` as a toast —
    // nothing further to do here.
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

  const availableBalanceText = depositBalance
    ? `${formatBalanceAmount(depositBalance, tokenCode, maxDepositableBn)} ${t(
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
          onPickerPress={() => {}}
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
    </BaseLayout>
  );
};

export default EarnAmountScreen;
