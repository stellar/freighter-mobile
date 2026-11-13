import { BottomSheetModal } from "@gorhom/bottom-sheet";
import blendIcon from "assets/logos/blend-icon.png";
import BigNumber from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import { BottomSheetHeader } from "components/BottomSheetHeader";
import { TokenIcon } from "components/TokenIcon";
import {
  EarnDetailsCard,
  EarnDetailsRow,
} from "components/screens/EarnScreen/components/EarnDetailsCard";
import {
  formatProjection,
  formatRate,
  projectEarnings,
} from "components/screens/EarnScreen/helpers";
import SignTransactionDetailsBottomSheet, {
  SignTransactionDetailsHeader,
} from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import { BUTTON_THEME } from "components/sds/Button/theme";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { mapNetworkToNetworkDetails } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { getBalanceByContractId } from "helpers/balances";
import { pxValue } from "helpers/dimensions";
import {
  NO_FIAT_VALUE,
  formatFiatAmount,
  formatTokenForDisplay,
} from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useMemo, useRef } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import type { SecurityAssessment } from "services/blockaid/types";

export interface EarnReviewBottomSheetProps {
  bottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
  /**
   * The amount the staged XDR in `transactionBuilder` was built with, in
   * display (non-raw) units. `EarnAmountScreen` records it when it opens
   * Review, so a later edit of the amount field can't change what this sheet
   * shows.
   */
  tokenAmount: string;
  /**
   * True while the staged transaction is being rebuilt, after a settings
   * change. Confirm and the settings button wait for it, so Confirm never
   * signs the transaction the rebuild is replacing.
   */
  isRebuilding?: boolean;
  transactionSecurityAssessment: SecurityAssessment;
  onSecurityWarningPress: () => void;
  onConfirm: () => void;
  /**
   * Opens the shared `TransactionSettingsBottomSheet` (fee/timeout) —
   * mirrors `SendReviewBottomSheet`/`SwapReviewBottomSheet`'s footer
   * settings button. Omitted (button hidden)
   * when the security assessment isn't trusted, matching those same
   * sheets' own layout for that state.
   */
  onSettingsPress?: () => void;
}

/**
 * Earn deposit review. Mirrors `SwapReviewBottomSheet`'s structure (pure
 * content; the parent owns the `BottomSheetModal` ref and wraps this in
 * `<BottomSheet>`), but is self-sufficient about most of its own data —
 * reading the pool/asset/fee state directly off the earn and
 * transactionBuilder ducks — since (unlike Swap) there is exactly one call
 * site and no reason to thread every field through props.
 *
 * `tokenAmount` is the one genuine exception: the entered amount lives in
 * the amount screen's local `useTokenFiatConverter` state, not a duck, so it
 * has to come in via a prop. It is read-only here — see the invariant note
 * further down on why this sheet never needs to correct it.
 */
export const EarnReviewBottomSheet: React.FC<EarnReviewBottomSheetProps> = ({
  bottomSheetModalRef,
  tokenAmount,
  transactionSecurityAssessment,
  onSecurityWarningPress,
  onConfirm,
  onSettingsPress,
  isRebuilding = false,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { network } = useAuthenticationStore();
  const { pricedBalances } = useBalancesStore();

  const pool = useEarnStore((state) => state.pool);
  const selectedAssetId = useEarnStore((state) => state.selectedAssetId);
  const selectedAssetApy = useEarnStore((state) => state.selectedAssetApy);
  const selectedAssetCode = useEarnStore((state) => state.selectedAssetCode);
  const selectedAssetDecimals = useEarnStore(
    (state) => state.selectedAssetDecimals,
  );
  const currentPositionTokens = useEarnStore(
    (state) => state.currentPositionTokens,
  );

  // "Transaction details" opens the FULL decoded transaction -- summary
  // (fee, sequence, memo, raw XDR), auth entries, and operations -- exactly
  // as the dapp signing review and the Send/Swap reviews do, via the shared
  // `useSignTransactionDetails` + `SignTransactionDetailsBottomSheet` pair.
  //
  // It previously opened `useFeeDetailsBottomSheet`'s fee breakdown, which is
  // a much narrower surface: the fee alone. The fee is still reachable here,
  // as the summary's own `feeXlm` row, so nothing is lost by pointing the row
  // at the full details instead.
  const { transactionXDR } = useTransactionBuilderStore();
  const transactionDetails = useSignTransactionDetails({
    xdr: transactionXDR || "",
  });
  const transactionDetailsSheetRef = useRef<BottomSheetModal>(null);

  const handleDismissTransactionDetails = useCallback(() => {
    transactionDetailsSheetRef.current?.dismiss();
  }, []);

  const renderTransactionDetailsHeader = useCallback(
    () => (
      <SignTransactionDetailsHeader
        onDismiss={handleDismissTransactionDetails}
      />
    ),
    [handleDismissTransactionDetails],
  );

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const depositBalance = useMemo(
    () =>
      getBalanceByContractId(selectedAssetId, pricedBalances, networkDetails),
    [selectedAssetId, pricedBalances, networkDetails],
  );

  // INVARIANT this sheet relies on: by the time it is mounted and visible,
  // the staged XDR in `transactionBuilder` already corresponds exactly to
  // `tokenAmount` below, for every asset, XLM included. `EarnAmountScreen`'s
  // CTA handler checks the measured resource fee against an XLM deposit's
  // remaining balance (see `getXlmFeeShortfall`) BEFORE this sheet is ever
  // presented, and blocks there rather than adjusting the amount — it never
  // opens Review with a display value the staged XDR doesn't match. This
  // sheet therefore never needs to touch or re-check the amount itself.
  const depositUsd = useMemo(() => {
    if (!depositBalance?.currentPrice || depositBalance.currentPrice.isZero()) {
      return null;
    }
    return new BigNumber(tokenAmount || "0")
      .multipliedBy(depositBalance.currentPrice)
      .toFixed();
  }, [depositBalance, tokenAmount]);

  // `currentPositionTokens` is `total_tokens`, not `supplied_tokens` — see
  // `getBlendSuppliedTokens`'s docs. Deposits use SupplyCollateral, so the
  // plain-supply bucket never reflects a top-up.
  const beforeTokens = useMemo(
    () =>
      new BigNumber(currentPositionTokens).shiftedBy(-selectedAssetDecimals),
    [currentPositionTokens, selectedAssetDecimals],
  );
  const afterTokens = useMemo(
    () => beforeTokens.plus(new BigNumber(tokenAmount || "0")),
    [beforeTokens, tokenAmount],
  );

  // USD value of the position once this deposit lands. The estimated
  // earnings are for that whole position: with no earlier position it is just
  // the deposit.
  const totalPositionUsd = useMemo(() => {
    if (!depositBalance?.currentPrice || depositBalance.currentPrice.isZero()) {
      return null;
    }
    return afterTokens.multipliedBy(depositBalance.currentPrice).toFixed();
  }, [depositBalance, afterTokens]);

  const { monthly, yearly } = useMemo(
    () =>
      projectEarnings({ depositUsd: totalPositionUsd, apy: selectedAssetApy }),
    [totalPositionUsd, selectedAssetApy],
  );

  // An unknown projection reads "--" rather than "≈ --".
  const formatEstimate = (value: string | null) =>
    value === null
      ? "--"
      : t("earnReview.estimatedValue", { value: formatProjection(value) });

  const { isMalicious, isSuspicious, isUnableToScan } =
    transactionSecurityAssessment;
  const isTrusted = !isMalicious && !isSuspicious;

  const bannerText = useMemo(() => {
    if (isMalicious) {
      return t("transactionAmountScreen.errors.malicious");
    }
    if (isSuspicious) {
      return t("transactionAmountScreen.errors.suspicious");
    }
    if (isUnableToScan) {
      return t("securityWarning.proceedWithCaution");
    }
    return "";
  }, [isMalicious, isSuspicious, isUnableToScan, t]);

  const handleCancel = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, [bottomSheetModalRef]);

  // Nothing to sign while a rebuild is under way, or after one failed.
  const canConfirm = !isRebuilding && !!transactionXDR;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) {
      return;
    }
    bottomSheetModalRef.current?.dismiss();
    onConfirm();
  }, [bottomSheetModalRef, onConfirm, canConfirm]);

  const detailRows: EarnDetailsRow[] = [
    {
      key: "position",
      label: t("earnReview.position"),
      value: (
        <Text md medium secondary testID="earn-review-position">
          {`${formatTokenForDisplay(beforeTokens)} → `}
          <Text md medium primary>
            {formatTokenForDisplay(afterTokens, selectedAssetCode)}
          </Text>
        </Text>
      ),
    },
    {
      key: "depositApy",
      label: t("earnReview.depositApy"),
      value: formatRate(selectedAssetApy),
      valueColor: selectedAssetApy === null ? undefined : themeColors.green[11],
      isEmphasized: true,
      testID: "earn-review-apy",
    },
    {
      key: "monthly",
      label: t("earnReview.estMonthlyEarnings"),
      value: formatEstimate(monthly),
      testID: "earn-review-monthly",
    },
    {
      key: "yearly",
      label: t("earnReview.estYearlyEarnings"),
      value: formatEstimate(yearly),
      testID: "earn-review-yearly",
    },
  ];

  return (
    <View className="flex-1 gap-[24px]" testID="earn-review-sheet">
      <BottomSheetHeader title={t("earnReview.sheetTitle")} layout="centered" />

      <View className="gap-[12px]">
        <View className="gap-[16px] rounded-[16px] bg-background-tertiary p-[16px]">
          <Text md medium primary>
            {t("earnReview.title")}
          </Text>

          {depositBalance && (
            <View className="gap-[16px]">
              <View className="w-full flex-row items-center gap-[16px]">
                <TokenIcon token={depositBalance} />
                <View className="flex-1">
                  <Text lg medium primary>
                    {formatTokenForDisplay(
                      tokenAmount || "0",
                      selectedAssetCode,
                    )}
                  </Text>
                  <Text sm medium secondary>
                    {depositUsd !== null
                      ? formatFiatAmount(depositUsd)
                      : NO_FIAT_VALUE}
                  </Text>
                </View>
              </View>

              <View className="w-[40px] items-center">
                <Icon.ArrowDown
                  size={16}
                  color={themeColors.foreground.primary}
                />
              </View>

              <View className="w-full flex-row items-center gap-[16px]">
                <Image
                  source={blendIcon}
                  className="size-[40px] rounded-[4px]"
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                <View className="flex-1">
                  <Text sm medium secondary>
                    {t("earnReview.to")}
                  </Text>
                  <Text lg medium primary testID="earn-review-pool">
                    {pool?.name ?? "--"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {(isMalicious || isSuspicious || isUnableToScan) && (
          <Banner
            testID="security-warning-banner"
            variant={isSuspicious || isUnableToScan ? "warning" : "error"}
            text={bannerText}
            onPress={onSecurityWarningPress}
          />
        )}

        <EarnDetailsCard rows={detailRows} testID="earn-review-details" />

        {/* Opens the full decoded transaction, the same sheet the dapp
            signing review and the Send/Swap reviews use. */}
        <TouchableOpacity
          onPress={() => transactionDetailsSheetRef.current?.present()}
          className="flex-row items-center gap-[4px] rounded-[16px] border border-gray-5 bg-background-primary px-[16px] py-[12px]"
          testID="earn-review-transaction-details"
        >
          <Icon.List size={16} color={themeColors.foreground.primary} />
          <Text md semiBold primary>
            {t("earnReview.transactionDetails")}
          </Text>
        </TouchableOpacity>
      </View>

      {isTrusted ? (
        <View className="flex-row items-center gap-[8px]">
          {onSettingsPress && (
            <TouchableOpacity
              onPress={onSettingsPress}
              disabled={isRebuilding}
              className="items-center justify-center border border-gray-6 bg-background-primary"
              // Sized to sit flush beside the xl Buttons next to it.
              style={{
                height: pxValue(BUTTON_THEME.height.xl),
                borderRadius: pxValue(BUTTON_THEME.height.xl / 2),
                width: pxValue(BUTTON_THEME.height.xl),
                opacity: isRebuilding ? 0.5 : 1,
              }}
              accessibilityRole="button"
              accessibilityLabel={t("earnReview.settings")}
              testID="earn-review-settings-button"
            >
              <Icon.Settings04
                size={18}
                color={themeColors.foreground.primary}
              />
            </TouchableOpacity>
          )}
          <View className="flex-1">
            <Button
              tertiary
              xl
              isFullWidth
              onPress={handleCancel}
              testID="earn-review-cancel-button"
            >
              {t("common.cancel")}
            </Button>
          </View>
          <View className="flex-1">
            <Button
              biometric
              secondary
              xl
              isFullWidth
              onPress={handleConfirm}
              disabled={!canConfirm}
              isLoading={isRebuilding}
              testID="earn-review-confirm-button"
            >
              {t("common.confirm")}
            </Button>
          </View>
        </View>
      ) : (
        <View className="gap-[12px]">
          <Button
            xl
            isFullWidth
            destructive={isMalicious}
            tertiary={!isMalicious}
            onPress={handleCancel}
            testID="earn-review-cancel-button"
          >
            {t("common.cancel")}
          </Button>
          <TextButton
            text={t("transactionAmountScreen.confirmAnyway")}
            onPress={handleConfirm}
            disabled={!canConfirm}
            variant={isMalicious ? "error" : "secondary"}
            testID="earn-review-confirm-anyway-button"
          />
        </View>
      )}

      {transactionDetails && (
        <BottomSheet
          modalRef={transactionDetailsSheetRef}
          scrollable
          enablePanDownToClose={false}
          analyticsEvent={AnalyticsEvent.VIEW_EARN_TRANSACTION_DETAILS}
          scrollViewHeaderComponent={renderTransactionDetailsHeader}
          customContent={
            <SignTransactionDetailsBottomSheet data={transactionDetails} />
          }
        />
      )}
    </View>
  );
};

export default EarnReviewBottomSheet;
