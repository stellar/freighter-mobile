import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import blendIcon from "assets/logos/blend-icon.png";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { TokenIcon } from "components/TokenIcon";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnDepositDetailsBottomSheet } from "components/screens/EarnScreen/components/EarnDepositDetailsBottomSheet";
import { getPoolDisplayName } from "components/screens/EarnScreen/helpers/poolDisplayName";
import { EarnTransactionStatus } from "components/screens/EarnScreen/hooks/useEarnTransaction";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent, buildScreenViewedProps } from "config/analyticsConfig";
import { mapNetworkToNetworkDetails } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { getBalanceByContractId } from "helpers/balances";
import { pxValue } from "helpers/dimensions";
import { formatTokenForDisplay } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Image, View } from "react-native";
import { track } from "services/analytics/core";

/**
 * How far above the middle of the free space the status block sits: the
 * design centers it 128 above the middle of the whole frame, which is about
 * 67 above the middle of the space above the actions; padding the bottom by
 * twice that lifts it there.
 */
const STATUS_BLOCK_LIFT = 134;

export interface EarnProcessingScreenProps {
  /**
   * Only "submitting" and "success" — there is no dedicated failure screen: on failure `EarnAmountScreen` returns
   * automatically to the normal amount screen, where the retry banner
   * (driven by the earn duck's `lastSubmitFailed`) takes over. Excluding
   * "idle" and "error" here makes that illegal state unrepresentable rather
   * than relying on the caller to simply not pass them.
   */
  status: Exclude<EarnTransactionStatus, "idle" | "error">;
  /** The amount entered on the amount screen, in display (non-raw) units. */
  tokenAmount: string;
  /**
   * Set once `submit()` resolves successfully; null while still submitting.
   * Threaded through as a prop for the same reason `tokenAmount` is (see
   * below): it lives in `useEarnTransaction`'s local state, not a duck.
   * Powers the "View transaction" explorer link on the success state.
   */
  transactionHash: string | null;
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
}

/**
 * Earn deposit terminal screen. Mirrors `SwapProcessingScreen`'s structure
 * (icon + status text + a card summarizing what happened) but, like
 * `EarnReviewBottomSheet`, reads the pool/asset it's summarizing directly
 * off `useEarnStore` and `useBalancesStore` rather than threading them
 * through props — `tokenAmount` and `transactionHash` are the exceptions,
 * since they live in the amount screen's local hook state
 * (`useTokenFiatConverter` / `useEarnTransaction`), not a duck.
 *
 * Rendered INLINE from `EarnAmountScreen` (not a registered route) whenever
 * status is "submitting" or "success" — see `useEarnTransaction`. This
 * structurally prevents a swipe-back gesture from abandoning an in-flight
 * submit, which is stronger than relying on a navigator's
 * `gestureEnabled: false`. There used to be a third, "error" state rendered
 * here (a full-screen "Deposit failed" step) — the design has
 * no such screen, so it was removed; `EarnAmountScreen` now returns
 * automatically to the normal amount screen on failure instead.
 */
const EarnProcessingScreen: React.FC<EarnProcessingScreenProps> = ({
  status,
  tokenAmount,
  transactionHash,
  onCloseWhileSubmitting,
  onDone,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const navigation = useNavigation();
  const { network } = useAuthenticationStore();
  const { pricedBalances } = useBalancesStore();

  const selectedAssetId = useEarnStore((state) => state.selectedAssetId);
  const selectedAssetCode = useEarnStore((state) => state.selectedAssetCode);
  const pool = useEarnStore((state) => state.pool);
  const hasEmittedSuccessView = useRef(false);

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const depositBalance = useMemo(
    () =>
      getBalanceByContractId(selectedAssetId, pricedBalances, networkDetails),
    [selectedAssetId, pricedBalances, networkDetails],
  );

  // Neither this screen nor the review sheet it follows is a registered
  // route (see the component doc above), so screen.viewed for the
  // earn_processing funnel stage doesn't come free from route-based
  // analytics -- emit it manually. The component only ever mounts once
  // `status` has left "idle" (see `EarnAmountScreen`'s inline gate), so a
  // bare mount effect fires this exactly once per submission, mirroring
  // `TransactionProcessingScreen`'s VIEW_SEND_PROCESSING emission.
  useEffect(() => {
    track(
      AnalyticsEvent.SCREEN_VIEWED,
      buildScreenViewedProps(AnalyticsEvent.VIEW_EARN_PROCESSING),
    );
  }, []);

  // This same screen also renders the terminal success state (see
  // `getStatusText`/`getStatusIcon` below), so emit the earn_success funnel
  // stage when `status` settles into "success" -- completing
  // select_token -> amount -> review -> processing -> success cross-platform.
  // Guarded to fire at most once per mount, mirroring
  // `TransactionProcessingScreen`'s VIEW_SEND_SUCCESS emission.
  useEffect(() => {
    if (status === "success" && !hasEmittedSuccessView.current) {
      hasEmittedSuccessView.current = true;
      track(
        AnalyticsEvent.SCREEN_VIEWED,
        buildScreenViewedProps(AnalyticsEvent.VIEW_EARN_SUCCESS),
      );
    }
  }, [status]);

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

  const isSuccess = status === "success";

  // "View transaction" opens the deposit's receipt; its own CTA links out to
  // stellar.expert.
  const depositDetailsSheetRef = useRef<BottomSheetModal>(null);
  const handleViewTransaction = useCallback(() => {
    depositDetailsSheetRef.current?.present();
  }, []);
  const handleCloseDepositDetails = useCallback(() => {
    depositDetailsSheetRef.current?.dismiss();
  }, []);

  return (
    <BaseLayout insets={{ top: true }}>
      <View className="flex-1" testID="earn-processing-screen">
        {/* The status block sits a little above the middle of the screen,
            as the design centers it on the frame rather than on the space
            left above the actions. */}
        <View
          className="flex-1 items-center justify-center"
          style={{ paddingBottom: pxValue(STATUS_BLOCK_LIFT) }}
        >
          <View className="w-full items-center gap-[32px]">
            <View className="items-center gap-[8px]">
              {isSuccess ? (
                <Icon.CheckCircle
                  size={36}
                  color={themeColors.status.success}
                />
              ) : (
                <Spinner size="large" color={themeColors.foreground.primary} />
              )}
              <Display
                xs
                medium
                style={{ letterSpacing: -0.96, textAlign: "center" }}
              >
                {isSuccess
                  ? t("earnProcessing.deposited")
                  : t("earnProcessing.depositing")}
              </Display>
            </View>

            {/* The deposit asset, an arrow, then the pool's Blend mark, over
                "<amount> to <pool>". The same for both states. */}
            <View className="w-full items-center gap-[24px] rounded-[16px] bg-background-tertiary p-[24px]">
              <View className="flex-row items-center justify-center gap-[16px]">
                {depositBalance && (
                  <TokenIcon token={depositBalance} size="lg" />
                )}
                <Icon.ArrowRight
                  size={16}
                  color={themeColors.foreground.primary}
                />
                <Image
                  source={blendIcon}
                  className="size-[40px] rounded-[10px]"
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              </View>

              <Text
                xl
                medium
                primary
                textAlign="center"
                testID="earn-processing-caption"
              >
                {formatTokenForDisplay(tokenAmount, selectedAssetCode)}
                <Text xl medium secondary>
                  {` ${t("earnProcessing.to")} `}
                </Text>
                {pool?.name && getPoolDisplayName(pool.name, t)}
              </Text>
            </View>
          </View>
        </View>

        {isSuccess ? (
          <View className="gap-[12px]">
            {transactionHash && (
              <Button
                tertiary
                xl
                onPress={handleViewTransaction}
                testID="earn-processing-view-transaction-button"
              >
                {t("earnProcessing.viewTransaction")}
              </Button>
            )}
            <Button
              secondary
              xl
              onPress={onDone}
              testID="earn-processing-done-button"
            >
              {t("common.done")}
            </Button>
          </View>
        ) : (
          <View className="gap-[24px]">
            <Text sm medium secondary textAlign="center">
              {t("earnProcessing.closeMessage")}
            </Text>
            <Button
              tertiary
              xl
              onPress={onCloseWhileSubmitting}
              testID="earn-processing-close-button"
            >
              {t("common.close")}
            </Button>
          </View>
        )}
      </View>

      <BottomSheet
        modalRef={depositDetailsSheetRef}
        customContent={
          <EarnDepositDetailsBottomSheet
            tokenAmount={tokenAmount}
            transactionHash={transactionHash}
            onClose={handleCloseDepositDetails}
          />
        }
      />
    </BaseLayout>
  );
};

export default EarnProcessingScreen;
