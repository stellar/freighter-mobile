import { useNavigation } from "@react-navigation/native";
import Spinner from "components/Spinner";
import { TokenIcon } from "components/TokenIcon";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnTransactionStatus } from "components/screens/EarnScreen/hooks/useEarnTransaction";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { mapNetworkToNetworkDetails } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { getBalanceByContractId } from "helpers/balances";
import { formatTokenForDisplay } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useLayoutEffect, useMemo } from "react";
import { View } from "react-native";

export interface EarnProcessingScreenProps {
  /** Excludes "idle" — `EarnAmountScreen` only renders this screen once a
   * submit is underway; "idle" means the normal amount screen is showing. */
  status: Exclude<EarnTransactionStatus, "idle">;
  /** The amount entered on the amount screen, in display (non-raw) units. */
  tokenAmount: string;
  /** The real reason sourced from `transactionBuilder`/`useEarnTransaction`
   * — never a fabricated message. Only rendered when `status === "error"`. */
  error: string | null;
  /**
   * Close while a submit is still in flight. Per the flow's design this
   * returns the user Home WITHOUT waiting for the result — there is no
   * background-submission infrastructure to keep tracking the deposit once
   * this screen (and the amount screen mounted underneath it) unmount. This
   * is intentional: the caller (`EarnAmountScreen`) marks the in-flight
   * submit abandoned via `useEarnTransaction`'s `abandon()` before
   * navigating away, so when it eventually settles it skips every write —
   * including the persisted `useEarnStore.setSubmitFailed` flag — meaning
   * nothing surfaces here or corrupts a later Earn session's retry banner.
   */
  onCloseWhileSubmitting: () => void;
  /** Success's "Done" action: resets the earn duck and returns Home. */
  onDone: () => void;
  /** Error's action: drops back to the amount screen, where
   * `lastSubmitFailed` (already set by the failed submit) shows the retry
   * banner. */
  onBackToAmount: () => void;
}

/**
 * Earn deposit terminal screen. Mirrors `SwapProcessingScreen`'s structure
 * (icon + status text + a card summarizing what happened) but, like
 * `EarnReviewBottomSheet`, reads the pool/asset it's summarizing directly
 * off `useEarnStore` and `useBalancesStore` rather than threading them
 * through props — `tokenAmount` is the one exception, since it lives in the
 * amount screen's local `useTokenFiatConverter` state, not a duck.
 *
 * Rendered INLINE from `EarnAmountScreen` (not a registered route) behind a
 * `status !== "idle"` gate — see `useEarnTransaction`. This structurally
 * prevents a swipe-back gesture from abandoning an in-flight submit, which
 * is stronger than relying on a navigator's `gestureEnabled: false`.
 */
const EarnProcessingScreen: React.FC<EarnProcessingScreenProps> = ({
  status,
  tokenAmount,
  error,
  onCloseWhileSubmitting,
  onDone,
  onBackToAmount,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const navigation = useNavigation();
  const { network } = useAuthenticationStore();
  const { pricedBalances } = useBalancesStore();

  const selectedAssetId = useEarnStore((state) => state.selectedAssetId);
  const selectedAssetCode = useEarnStore((state) => state.selectedAssetCode);

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const depositBalance = useMemo(
    () =>
      getBalanceByContractId(selectedAssetId, pricedBalances, networkDetails),
    [selectedAssetId, pricedBalances, networkDetails],
  );

  // This screen replaces EarnAmountScreen's body inline, but that screen
  // still has a registered header (via EarnNavigator) — hide it while this
  // is showing and restore it on unmount, same as SwapProcessingScreen.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(
    () => () =>
      navigation.setOptions({
        headerShown: true,
      }),
    [navigation],
  );

  const getStatusText = () => {
    switch (status) {
      case "success":
        return t("earnProcessing.deposited");
      case "error":
        return t("earnProcessing.failed");
      case "submitting":
      default:
        return t("earnProcessing.depositing");
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "success":
        return (
          <Icon.CheckCircle size={48} color={themeColors.status.success} />
        );
      case "error":
        return <Icon.XCircle size={48} themeColor="red" />;
      case "submitting":
      default:
        return <Spinner size="large" color={themeColors.base[1]} />;
    }
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 justify-between" testID="earn-processing-screen">
        <View className="flex-1 items-center justify-center">
          <View className="items-center gap-[8px] w-full">
            {getStatusIcon()}

            <View className="mb-2">
              <Display xs medium>
                {getStatusText()}
              </Display>
            </View>

            <View className="rounded-[16px] p-[24px] gap-[16px] bg-background-tertiary w-full">
              <View className="flex-row items-center justify-center">
                {depositBalance && (
                  <TokenIcon token={depositBalance} size="lg" />
                )}
              </View>

              <View className="items-center">
                <Text xl medium primary testID="earn-processing-amount">
                  {formatTokenForDisplay(tokenAmount, selectedAssetCode)}
                </Text>
              </View>
            </View>

            {status === "error" && error && (
              <View className="mt-2">
                <Text
                  sm
                  medium
                  secondary
                  textAlign="center"
                  testID="earn-processing-error-detail"
                >
                  {error}
                </Text>
              </View>
            )}
          </View>
        </View>

        {status === "success" && (
          <View className="gap-[16px]">
            <Button
              tertiary
              xl
              onPress={onDone}
              testID="earn-processing-done-button"
            >
              {t("common.done")}
            </Button>
          </View>
        )}

        {status === "error" && (
          <View className="gap-[16px]">
            <Button
              tertiary
              xl
              onPress={onBackToAmount}
              testID="earn-processing-back-to-amount-button"
            >
              {t("earnProcessing.backToAmount")}
            </Button>
          </View>
        )}

        {status === "submitting" && (
          <View className="gap-[16px]">
            <Text sm medium secondary textAlign="center">
              {t("earnProcessing.closeMessage")}
            </Text>
            <Button
              secondary
              xl
              onPress={onCloseWhileSubmitting}
              testID="earn-processing-close-button"
            >
              {t("common.close")}
            </Button>
          </View>
        )}
      </View>
    </BaseLayout>
  );
};

export default EarnProcessingScreen;
