import { BottomSheetModal } from "@gorhom/bottom-sheet";
import blendIcon from "assets/logos/blend-icon.png";
import BigNumber from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import {
  formatProjection,
  formatRate,
  projectCurrentEarnings,
  projectEarnings,
} from "components/screens/EarnScreen/helpers";
import SignTransactionDetailsBottomSheet from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
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
   * The amount entered on the amount screen, in display (non-raw) units.
   * Guaranteed by `EarnAmountScreen`'s CTA handler to already match the
   * staged XDR in `transactionBuilder` — see the component doc below.
   */
  tokenAmount: string;
  transactionSecurityAssessment: SecurityAssessment;
  onSecurityWarningPress: () => void;
  onConfirm: () => void;
  /**
   * Opens the shared `TransactionSettingsBottomSheet` (fee/timeout) —
   * mirrors `SendReviewBottomSheet`/`SwapReviewBottomSheet`'s footer
   * settings button (Figma node `9448:29608`). Omitted (button hidden)
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

  // USD value of the position as it stands today, and as it will stand once
  // this deposit lands -- the two inputs for the Details card's before →
  // after earnings rows (design `9448:29581`). Both share `depositBalance`'s
  // price with `depositUsd` above, so they only diverge from it (and from
  // each other) when there is already a pre-existing position -- the
  // first-deposit case collapses `currentPositionUsd` to "0", matching the
  // "0.00 → 500.00 USDC" example in the mock exactly.
  const currentPositionUsd = useMemo(() => {
    if (!depositBalance?.currentPrice || depositBalance.currentPrice.isZero()) {
      return null;
    }
    return beforeTokens.multipliedBy(depositBalance.currentPrice).toFixed();
  }, [depositBalance, beforeTokens]);

  const totalPositionUsd = useMemo(() => {
    if (!depositBalance?.currentPrice || depositBalance.currentPrice.isZero()) {
      return null;
    }
    return afterTokens.multipliedBy(depositBalance.currentPrice).toFixed();
  }, [depositBalance, afterTokens]);

  const { monthly: beforeMonthly, yearly: beforeYearly } = useMemo(
    () =>
      projectCurrentEarnings({
        currentPositionUsd,
        apy: selectedAssetApy,
      }),
    [currentPositionUsd, selectedAssetApy],
  );
  const { monthly: afterMonthly, yearly: afterYearly } = useMemo(
    () =>
      projectEarnings({ depositUsd: totalPositionUsd, apy: selectedAssetApy }),
    [totalPositionUsd, selectedAssetApy],
  );

  // Both sides are only ever null together -- they share the same `apy` and
  // the same underlying price -- so an unknown projection collapses to a
  // single "--" rather than "-- → --".
  const monthlyDisplay =
    beforeMonthly === null && afterMonthly === null
      ? "--"
      : t("earnReview.monthlyEarningsValue", {
          before: formatProjection(beforeMonthly),
          after: formatProjection(afterMonthly),
        });
  const yearlyDisplay =
    beforeYearly === null && afterYearly === null
      ? "--"
      : t("earnReview.yearlyEarningsValue", {
          before: formatProjection(beforeYearly),
          after: formatProjection(afterYearly),
        });

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
          <View className="gap-[16px]">
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

            {/* Source → destination connector (design `9448:29579`) — same
                glyph/placement as `SendReviewBottomSheet`'s sender → recipient
                chevron, aligned under the leading icon column above. */}
            <View className="w-[40px] items-center py-1">
              <Icon.ChevronDownDouble
                size={16}
                color={themeColors.foreground.secondary}
              />
            </View>

            <View className="w-full flex-row items-center gap-[16px]">
              {/* The real Blend mark, shared with `PoolCard`, the pool
                  details sheet, and the token picker's badge. Sized 40 to sit
                  in the same leading-icon column as the deposit asset's
                  `TokenIcon` above (also 40, as is the connector between
                  them); the lilac `InfoCircle` placeholder this replaces was
                  28, so it never lined up with that column. */}
              <Image
                source={blendIcon}
                className="size-10 rounded"
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
              <View className="flex-1">
                <Text sm secondary>
                  {t("earnReview.to")}
                </Text>
                <Text md medium testID="earn-review-pool">
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
          className="mt-[16px]"
          variant={isSuspicious || isUnableToScan ? "warning" : "error"}
          text={bannerText}
          onPress={onSecurityWarningPress}
        />
      )}

      {/* Details card (design `9448:29581`) — Position / Current APY /
          Monthly earnings (est.) / Yearly earnings (est.). Only Position
          carries a leading icon (the deposited asset's own small token
          mark) — the other three rows are iconless, confirmed against the
          render. Earnings render as before → after; Current APY renders in
          `status.success` green (plain text, confirmed against the render —
          not the picker/ribbon `green-10` pill; see this file's design-fix
          report). */}
      <List
        variant="secondary"
        className="mt-[16px]"
        items={[
          {
            // Small (`sm` = 16px) token icon — the same `TokenIcon` used at
            // full size in the summary card's asset row above, sized down to
            // sit inline with the row label rather than the picker's 32px
            // row icon.
            icon: depositBalance ? (
              <TokenIcon token={depositBalance} size="sm" />
            ) : undefined,
            titleComponent: (
              <Text md secondary>
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
            titleComponent: (
              <Text md secondary>
                {t("earnReview.apy")}
              </Text>
            ),
            trailingContent: (
              <Text
                md
                medium
                color={
                  selectedAssetApy !== null
                    ? themeColors.status.success
                    : undefined
                }
                testID="earn-review-apy"
              >
                {formatRate(selectedAssetApy)}
              </Text>
            ),
          },
          {
            titleComponent: (
              <Text md secondary>
                {t("earnReview.estMonthlyEarnings")}
              </Text>
            ),
            trailingContent: (
              <Text md medium testID="earn-review-monthly">
                {monthlyDisplay}
              </Text>
            ),
          },
          {
            titleComponent: (
              <Text md secondary>
                {t("earnReview.estYearlyEarnings")}
              </Text>
            ),
            trailingContent: (
              <Text md medium testID="earn-review-yearly">
                {yearlyDisplay}
              </Text>
            ),
          },
        ]}
      />

      <View className="mt-[12px]">
        <Text xs secondary textAlign="center">
          {t("earnReview.projectionDisclaimer")}
        </Text>
      </View>

      {/* "Transaction details" row (design `9448:29603`) — opens the full
          decoded transaction, the same sheet the dapp signing review and the
          Send/Swap reviews use. */}
      <TouchableOpacity
        onPress={() => transactionDetailsSheetRef.current?.present()}
        className="mt-[16px] flex-row items-center gap-[8px] p-[16px] rounded-[16px] bg-background-tertiary"
        testID="earn-review-transaction-details"
      >
        <Icon.List size={16} color={themeColors.lilac[11]} />
        <Text md medium color={themeColors.lilac[11]}>
          {t("earnReview.transactionDetails")}
        </Text>
      </TouchableOpacity>

      <View className="mt-[24px] gap-[12px]">
        {isTrusted ? (
          <View className="flex-row items-center gap-[12px]">
            {onSettingsPress && (
              // Same 50×50 circular affordance as `SendReviewFooter`'s and
              // `SwapReviewBottomSheet`'s settings button -- reused as-is
              // for cross-flow consistency rather than a one-off 36×36
              // square matching the mock's literal geometry (flagged in the
              // design-fix report).
              <TouchableOpacity
                onPress={onSettingsPress}
                className="border border-gray-6 items-center justify-center"
                style={{
                  height: pxValue(50),
                  borderRadius: pxValue(25),
                  width: pxValue(50),
                }}
                testID="earn-review-settings-button"
              >
                <Icon.Settings04 size={24} themeColor="gray" />
              </TouchableOpacity>
            )}
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

      {transactionDetails && (
        <BottomSheet
          modalRef={transactionDetailsSheetRef}
          handleCloseModal={() => transactionDetailsSheetRef.current?.dismiss()}
          enableDynamicSizing={false}
          useInsetsBottomPadding={false}
          enablePanDownToClose={false}
          analyticsEvent={AnalyticsEvent.VIEW_EARN_TRANSACTION_DETAILS}
          snapPoints={["90%"]}
          customContent={
            <SignTransactionDetailsBottomSheet
              data={transactionDetails}
              onDismiss={() => transactionDetailsSheetRef.current?.dismiss()}
            />
          }
        />
      )}
    </View>
  );
};

export default EarnReviewBottomSheet;
