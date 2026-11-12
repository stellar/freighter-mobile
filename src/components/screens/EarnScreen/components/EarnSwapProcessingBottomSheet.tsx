import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { BottomSheetCloseButton } from "components/BottomSheetHeader";
import Spinner from "components/Spinner";
import { TokenIcon } from "components/TokenIcon";
import SwapTransactionDetailsBottomSheet from "components/screens/SwapScreen/components/SwapTransactionDetailsBottomSheet";
import { SwapStatus } from "components/screens/SwapScreen/helpers";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent, buildScreenViewedProps } from "config/analyticsConfig";
import { logger } from "config/logger";
import { NativeToken, NonNativeToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { formatTokenForDisplay } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { track } from "services/analytics/core";
import { getTransactionDetails, TransactionDetail } from "services/stellar";

/** What the swap came to, for the picker's toast once the sheet closes. */
export interface EarnSwapOutcome {
  succeeded: boolean;
  sourceAmount: string;
  destinationAmount: string;
}

export interface EarnSwapProcessingBottomSheetProps {
  sourceAmount: string;
  sourceToken: NonNativeToken | NativeToken;
  /** The quoted amount; replaced by the settled one once it is known. */
  destinationAmount: string;
  destinationToken: NonNativeToken | NativeToken;
  /** X, Close and Done all leave the swap through here. */
  onClose: (outcome: EarnSwapOutcome) => void;
}

/**
 * A swap inside Earn, from submit to settlement, as a sheet over the token
 * picker: "Swap in progress" with a Close that leaves it running, then "Swap
 * complete" with the transaction's details and Done. Main Swap shows the
 * same states as a full screen; Earn keeps the user on the picker so the
 * token they just bought is right there to deposit.
 *
 * The status logic mirrors `SwapProcessingScreen`'s: the builder store
 * reports the submit, and the settled amounts come from the network once the
 * hash is known.
 */
export const EarnSwapProcessingBottomSheet: React.FC<
  EarnSwapProcessingBottomSheetProps
> = ({
  sourceAmount,
  sourceToken,
  destinationAmount,
  destinationToken,
  onClose,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { network } = useAuthenticationStore();
  const {
    transactionHash,
    error: transactionError,
    isSubmitting,
  } = useTransactionBuilderStore();
  const transactionDetailsSheetRef = useRef<BottomSheetModal>(null);

  const [status, setStatus] = useState<SwapStatus>(SwapStatus.SWAPPING);
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetail | null>(null);
  const hasEmittedSuccess = useRef(false);

  useEffect(() => {
    track(
      AnalyticsEvent.SCREEN_VIEWED,
      buildScreenViewedProps(AnalyticsEvent.VIEW_SWAP_PROCESSING),
    );
  }, []);

  useEffect(() => {
    if (transactionHash && !transactionError && !hasEmittedSuccess.current) {
      hasEmittedSuccess.current = true;
      track(
        AnalyticsEvent.SCREEN_VIEWED,
        buildScreenViewedProps(AnalyticsEvent.VIEW_SWAP_SUCCESS),
      );
    }
  }, [transactionHash, transactionError]);

  useEffect(() => {
    if (transactionError) {
      setStatus(SwapStatus.FAILED);
    } else if (transactionHash && transactionDetails) {
      setStatus(SwapStatus.SWAPPED);
    } else if (isSubmitting) {
      setStatus(SwapStatus.SWAPPING);
    }
  }, [transactionHash, transactionError, isSubmitting, transactionDetails]);

  useEffect(() => {
    if (transactionHash && !transactionDetails) {
      getTransactionDetails(transactionHash, network)
        .then((details) => {
          if (details) {
            setTransactionDetails(details);
          }
        })
        .catch((error) => {
          logger.error(
            "EarnSwapProcessingBottomSheet",
            "Failed to fetch transaction details",
            error,
            transactionHash,
          );
        });
    }
  }, [transactionHash, network, transactionDetails]);

  // The settled amounts replace the quote once the swap lands.
  const settled = useMemo(() => {
    if (status === SwapStatus.SWAPPED && transactionDetails?.swapDetails) {
      return {
        sourceAmount: transactionDetails.swapDetails.sourceAmount,
        destinationAmount: transactionDetails.swapDetails.destinationAmount,
      };
    }
    return { sourceAmount, destinationAmount };
  }, [status, transactionDetails, sourceAmount, destinationAmount]);

  const handleClose = () => {
    onClose({
      succeeded: status === SwapStatus.SWAPPED,
      sourceAmount: settled.sourceAmount,
      destinationAmount: settled.destinationAmount,
    });
  };

  const statusTitle = {
    [SwapStatus.SWAPPING]: t("earnSwapProcessing.inProgress"),
    [SwapStatus.SWAPPED]: t("earnSwapProcessing.complete"),
    [SwapStatus.FAILED]: t("swapProcessingScreen.failed"),
  }[status];

  const renderStatusIcon = () => {
    if (status === SwapStatus.SWAPPED) {
      return <Icon.CheckCircle size={36} color={themeColors.status.success} />;
    }
    if (status === SwapStatus.FAILED) {
      return <Icon.XCircle size={36} themeColor="red" />;
    }
    return <Spinner size="large" color={themeColors.foreground.primary} />;
  };

  const sourceText = formatTokenForDisplay(
    settled.sourceAmount,
    sourceToken.code,
  );

  const renderCaption = () => {
    if (status === SwapStatus.SWAPPED) {
      return (
        <>
          {sourceText}
          <Text xl medium secondary>
            {t("swapProcessingScreen.wasSwappedFor")}
          </Text>
          {formatTokenForDisplay(
            settled.destinationAmount,
            destinationToken.code,
          )}
        </>
      );
    }
    return (
      <>
        {sourceText}
        <Text xl medium secondary>
          {status === SwapStatus.FAILED
            ? t("swapProcessingScreen.couldNotBeSwappedFor")
            : t("swapProcessingScreen.to")}
        </Text>
        {destinationToken.code}
      </>
    );
  };

  return (
    <View className="gap-[24px]" testID="earn-swap-processing-sheet">
      <View className="items-end">
        <BottomSheetCloseButton
          onPress={handleClose}
          testID="earn-swap-processing-close-x"
        />
      </View>

      <View className="items-center gap-[8px]">
        {renderStatusIcon()}
        <Display
          xs
          medium
          style={{ letterSpacing: -0.96, textAlign: "center" }}
          testID="earn-swap-processing-title"
        >
          {statusTitle}
        </Display>
      </View>

      <View className="w-full items-center gap-[24px] rounded-[16px] bg-background-tertiary p-[24px]">
        <View className="flex-row items-center justify-center gap-[16px]">
          <TokenIcon token={sourceToken} size="lg" />
          <Icon.ArrowRight size={16} color={themeColors.foreground.primary} />
          <TokenIcon token={destinationToken} size="lg" />
        </View>
        <Text
          xl
          medium
          primary
          textAlign="center"
          testID="earn-swap-processing-caption"
        >
          {renderCaption()}
        </Text>
      </View>

      {status === SwapStatus.SWAPPED ? (
        <View className="gap-[12px]">
          <Button
            tertiary
            xl
            onPress={() => transactionDetailsSheetRef.current?.present()}
            testID="earn-swap-processing-view-transaction"
          >
            {t("swapProcessingScreen.viewTransaction")}
          </Button>
          <Button
            secondary
            xl
            onPress={handleClose}
            testID="earn-swap-processing-done"
          >
            {t("common.done")}
          </Button>
        </View>
      ) : (
        <View className="gap-[24px]">
          {status === SwapStatus.SWAPPING && (
            <Text sm medium secondary textAlign="center">
              {t("earnProcessing.closeMessage")}
            </Text>
          )}
          <Button
            tertiary
            xl
            onPress={handleClose}
            testID="earn-swap-processing-close"
          >
            {t("common.close")}
          </Button>
        </View>
      )}

      <BottomSheet
        modalRef={transactionDetailsSheetRef}
        customContent={
          <SwapTransactionDetailsBottomSheet
            sourceAmount={settled.sourceAmount}
            sourceToken={sourceToken}
            destinationAmount={settled.destinationAmount}
            destinationToken={destinationToken}
            transactionDetails={transactionDetails}
          />
        }
      />
    </View>
  );
};

export default EarnSwapProcessingBottomSheet;
