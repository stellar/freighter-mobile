import { useNavigation } from "@react-navigation/native";
import Spinner from "components/Spinner";
import { TokenIcon } from "components/TokenIcon";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnTransactionStatus } from "components/screens/EarnScreen/hooks/useEarnTransaction";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent, buildScreenViewedProps } from "config/analyticsConfig";
import { mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { getBalanceByContractId } from "helpers/balances";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { View } from "react-native";
import { track } from "services/analytics/core";

export interface EarnProcessingScreenProps {
  /**
   * Only "submitting" and "success" — per the design (`9599:40192`) there is
   * no dedicated failure screen: on failure `EarnAmountScreen` returns
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
 * here (a full-screen "Deposit failed" step) — the design (`9599:40192`) has
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
  const { open: openInAppBrowser } = useInAppBrowser();

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

  const getStatusText = () =>
    status === "success"
      ? t("earnProcessing.deposited")
      : t("earnProcessing.depositing");

  const getStatusIcon = () =>
    status === "success" ? (
      <Icon.CheckCircle size={24} color={themeColors.status.success} />
    ) : (
      <Spinner size="large" color={themeColors.base[1]} />
    );

  // "View transaction" (success only, design node `9449:29739`). Same
  // stellar.expert URL construction `SwapProcessingScreen`'s transaction
  // details sheet and `ManageAccounts`' "view on explorer" action use —
  // reused directly rather than hand-building the URL.
  const handleViewTransaction = useCallback(() => {
    if (!transactionHash) {
      return;
    }

    const explorerUrl = `${getStellarExpertUrl(network)}/tx/${transactionHash}`;

    openInAppBrowser(explorerUrl).catch((err) =>
      logger.error(
        "EarnProcessingScreen",
        "Error opening transaction explorer",
        err,
      ),
    );
  }, [transactionHash, network, openInAppBrowser]);

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

            {/* Triptych (design node `9449:29733`/`9449:29814`): the
             deposit asset's icon, a secondary double-chevron connector, then
             the pool's identity icon — no pool-artwork asset exists yet, so
             this reuses `PoolCard`'s own lilac-square placeholder for
             consistency across the flow, same reasoning as that
             component's doc comment. */}
            <View className="rounded-[16px] p-[24px] gap-[16px] bg-background-tertiary w-full">
              <View className="flex-row items-center justify-center gap-[16px]">
                {depositBalance && (
                  <TokenIcon token={depositBalance} size="lg" />
                )}
                <Icon.ChevronRightDouble
                  size={16}
                  color={themeColors.text.secondary}
                />
                <Icon.InfoCircle
                  themeColor="lilac"
                  withBackground
                  square
                  size={28}
                />
              </View>

              <View className="items-center">
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
                  {pool?.name}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {status === "success" && (
          <View className="gap-[16px]">
            {transactionHash && (
              <Button
                secondary
                xl
                onPress={handleViewTransaction}
                testID="earn-processing-view-transaction-button"
              >
                {t("earnProcessing.viewTransaction")}
              </Button>
            )}
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
