import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BigNumber from "bignumber.js";
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import {
  formatProjection,
  formatRate,
  projectEarnings,
} from "components/screens/EarnScreen/helpers";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import {
  MIN_TRANSACTION_FEE,
  NATIVE_TOKEN_CODE,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { getBalanceByContractId } from "helpers/balances";
import {
  NO_FIAT_VALUE,
  formatFiatAmount,
  formatTokenForDisplay,
} from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useFeeDetailsBottomSheet } from "hooks/useFeeDetailsBottomSheet";
import React, { useCallback, useMemo } from "react";
import { TouchableOpacity, View } from "react-native";
import type { SecurityAssessment } from "services/blockaid/types";

export interface EarnReviewBottomSheetProps {
  bottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
  /**
   * The amount entered on the amount screen, in display (non-raw) units.
   * Guaranteed by `EarnAmountScreen`'s CTA handler to already match the
   * staged XDR in `transactionBuilder` — see the component doc below.
   */
  tokenAmount: string;
  transactionSecurityAssessment: SecurityAssessment;
  onSecurityWarningPress: () => void;
  onConfirm: () => void;
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

  const sorobanInclusionFeeXlm = useTransactionBuilderStore(
    (state) => state.sorobanInclusionFeeXlm,
  );
  const sorobanResourceFeeXlm = useTransactionBuilderStore(
    (state) => state.sorobanResourceFeeXlm,
  );

  const { openFeeDetails, feeDetailsSheets } = useFeeDetailsBottomSheet({
    isSorobanContext: true,
  });

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const depositBalance = useMemo(
    () =>
      getBalanceByContractId(selectedAssetId, pricedBalances, networkDetails),
    [selectedAssetId, pricedBalances, networkDetails],
  );

  // The re-clamp against the REAL resource fee (see `clampXlmDepositAmount`)
  // happens in `EarnAmountScreen`'s CTA handler, BEFORE this sheet is ever
  // presented — not here. That is the invariant this sheet relies on: by the
  // time it is mounted and visible, the staged XDR in `transactionBuilder`
  // already corresponds exactly to `tokenAmount` below, for every asset,
  // XLM included. This sheet therefore never needs to touch the amount.
  const depositUsd = useMemo(() => {
    if (!depositBalance?.currentPrice || depositBalance.currentPrice.isZero()) {
      return null;
    }
    return new BigNumber(tokenAmount || "0")
      .multipliedBy(depositBalance.currentPrice)
      .toFixed();
  }, [depositBalance, tokenAmount]);

  const { monthly, yearly } = useMemo(
    () => projectEarnings({ depositUsd, apy: selectedAssetApy }),
    [depositUsd, selectedAssetApy],
  );

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

  const totalFeeXlm = sorobanResourceFeeXlm
    ? new BigNumber(sorobanInclusionFeeXlm ?? MIN_TRANSACTION_FEE)
        .plus(sorobanResourceFeeXlm)
        .toFixed()
    : (sorobanInclusionFeeXlm ?? MIN_TRANSACTION_FEE);

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

  const handleConfirm = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    onConfirm();
  }, [bottomSheetModalRef, onConfirm]);

  return (
    <View className="flex-1" testID="earn-review-sheet">
      <View className="rounded-[16px] p-[16px] gap-[16px] bg-background-tertiary">
        <Text lg medium>
          {t("earnReview.title")}
        </Text>

        {depositBalance && (
          <View className="w-full flex-row items-center gap-[16px]">
            <TokenIcon token={depositBalance} />
            <View className="flex-1">
              <Text xl medium>
                {formatTokenForDisplay(tokenAmount || "0", selectedAssetCode)}
              </Text>
              <Text md medium secondary>
                {depositUsd !== null
                  ? formatFiatAmount(depositUsd)
                  : NO_FIAT_VALUE}
              </Text>
            </View>
          </View>
        )}
      </View>

      {(isMalicious || isSuspicious || isUnableToScan) && (
        <Banner
          testID="security-warning-banner"
          className="mt-[16px]"
          variant={isSuspicious || isUnableToScan ? "warning" : "error"}
          text={bannerText}
          onPress={onSecurityWarningPress}
        />
      )}

      <List
        variant="secondary"
        className="mt-[16px]"
        items={[
          {
            icon: <Icon.Bank size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("earnReview.pool")}
              </Text>
            ),
            trailingContent: (
              <Text md medium testID="earn-review-pool">
                {pool?.name ?? "--"}
              </Text>
            ),
          },
          {
            icon: <Icon.Percent02 size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("earnReview.apy")}
              </Text>
            ),
            trailingContent: (
              <Text md medium testID="earn-review-apy">
                {formatRate(selectedAssetApy)}
              </Text>
            ),
          },
          {
            icon: <Icon.PiggyBank02 size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("earnReview.position")}
              </Text>
            ),
            trailingContent: (
              <Text md medium testID="earn-review-position">
                {t("earnReview.positionValue", {
                  before: formatTokenForDisplay(
                    beforeTokens,
                    selectedAssetCode,
                  ),
                  after: formatTokenForDisplay(afterTokens, selectedAssetCode),
                })}
              </Text>
            ),
          },
          {
            icon: <Icon.LineChartUp01 size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("earnReview.estMonthlyEarnings")}
              </Text>
            ),
            trailingContent: (
              <Text md medium testID="earn-review-monthly">
                {formatProjection(monthly)}
              </Text>
            ),
          },
          {
            icon: <Icon.LineChartUp02 size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("earnReview.estYearlyEarnings")}
              </Text>
            ),
            trailingContent: (
              <Text md medium testID="earn-review-yearly">
                {formatProjection(yearly)}
              </Text>
            ),
          },
          {
            icon: (
              <Icon.Route size={16} color={themeColors.foreground.primary} />
            ),
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("transactionAmountScreen.details.fee")}
              </Text>
            ),
            trailingContent: (
              <View className="flex-row items-center gap-[8px]">
                <TouchableOpacity
                  onPress={openFeeDetails}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="mt-[2px]"
                >
                  <Icon.InfoCircle themeColor="gray" size={16} />
                </TouchableOpacity>
                <Text md medium testID="earn-review-fee">
                  {formatTokenForDisplay(totalFeeXlm, NATIVE_TOKEN_CODE)}
                </Text>
              </View>
            ),
          },
        ]}
      />

      <View className="mt-[12px]">
        <Text xs secondary textAlign="center">
          {t("earnReview.projectionDisclaimer")}
        </Text>
      </View>

      <View className="mt-[24px] gap-[12px]">
        {isTrusted ? (
          <View className="flex-row gap-[12px]">
            <View className="flex-1">
              <Button
                secondary
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
                tertiary
                xl
                isFullWidth
                onPress={handleConfirm}
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
              variant={isMalicious ? "error" : "secondary"}
              testID="earn-review-confirm-anyway-button"
            />
          </View>
        )}
      </View>

      {feeDetailsSheets}
    </View>
  );
};

export default EarnReviewBottomSheet;
