import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { BottomSheetCloseButton } from "components/BottomSheetHeader";
import { TokenIcon } from "components/TokenIcon";
import {
  EarnDetailsCard,
  EarnDetailsRow,
} from "components/screens/EarnScreen/components/EarnDetailsCard";
import { getPositionPoolName } from "components/screens/PositionsScreen/helpers/positionFigures";
import SignTransactionDetailsBottomSheet, {
  SignTransactionDetailsHeader,
} from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { logger } from "config/logger";
import { Balance, Token } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { formatTransactionDate } from "helpers/date";
import {
  NO_FIAT_VALUE,
  formatTokenForDisplay,
  stroopToXlm,
} from "helpers/formatAmount";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { getTransactionDetails, TransactionDetail } from "services/stellar";

/** Which way the money moved. */
export type EarnDetailsType = "deposit" | "withdraw";

/** What can be tapped inside the sheet, for the caller's analytics. */
export type EarnDetailsAction = "transaction_details" | "explorer";

export interface EarnDepositDetailsBottomSheetProps {
  /** Deposit (the default) or withdrawal. */
  type?: EarnDetailsType;
  /** The amount moved, in display units and unsigned; null reads "--". */
  tokenAmount: string | null;
  tokenCode: string;
  /** The token, for its icon; none leaves the icon out. */
  token?: Token | Balance;
  /** The pool's name as the backend sent it. */
  poolName: string | null;
  /** The transaction's hash; until it's known the date and fee read "--". */
  transactionHash: string | null;
  /** The envelope "Transaction details" decodes; without it there is none. */
  transactionXdr: string | null;
  /** When it happened, if the caller knows: shown until the network's date. */
  occurredAt?: string;
  onClose: () => void;
  /**
   * Called when Transaction details or the explorer link is tapped. Position
   * Activity passes it; the deposit flow doesn't.
   */
  onAction?: (action: EarnDetailsAction) => void;
}

/**
 * The record of a deposit or withdrawal: where the money went or came from,
 * how much, its status and the fee actually charged, with the full decoded
 * transaction one tap away and a link to stellar.expert. Opened from "View
 * transaction" on the deposit's success screen, and from a position's
 * Activity rows.
 *
 * The amount carries no sign: the title already says which way it moved, so
 * the sheet reads the same from either entry point, as in the extension.
 *
 * The date and fee come from the network once the hash is known; until then
 * they read "--", the date unless the caller knows it.
 */
export const EarnDepositDetailsBottomSheet: React.FC<
  EarnDepositDetailsBottomSheetProps
> = ({
  type = "deposit",
  tokenAmount,
  tokenCode,
  token,
  poolName,
  transactionHash,
  transactionXdr,
  occurredAt,
  onClose,
  onAction,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { network } = useAuthenticationStore();
  const { open: openInAppBrowser } = useInAppBrowser();
  const isWithdraw = type === "withdraw";
  // Deposits keep the ids they always had.
  const testIDPrefix = `earn-${type}-details`;

  const [onChainDetails, setOnChainDetails] =
    useState<TransactionDetail | null>(null);

  useEffect(() => {
    if (!transactionHash) {
      return;
    }
    getTransactionDetails(transactionHash, network)
      .then((details) => {
        if (details) {
          setOnChainDetails(details);
        }
      })
      .catch((error) => {
        logger.error(
          "EarnDepositDetailsBottomSheet",
          "Failed to get the transaction's details",
          error,
        );
      });
  }, [transactionHash, network]);

  // The full decoded transaction, the same sheet the review offers.
  const transactionDetails = useSignTransactionDetails({
    xdr: transactionXdr || "",
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

  const handleViewTransactionDetails = useCallback(() => {
    onAction?.("transaction_details");
    transactionDetailsSheetRef.current?.present();
  }, [onAction]);

  const handleViewOnExplorer = useCallback(() => {
    if (!transactionHash) {
      return;
    }
    onAction?.("explorer");
    const explorerUrl = `${getStellarExpertUrl(network)}/tx/${transactionHash}`;
    openInAppBrowser(explorerUrl).catch((err) =>
      logger.error(
        "EarnDepositDetailsBottomSheet",
        "Error opening transaction explorer",
        err,
      ),
    );
  }, [transactionHash, network, openInAppBrowser, onAction]);

  const date = onChainDetails?.createdAt ?? occurredAt;

  const destinationRows: EarnDetailsRow[] = [
    {
      key: "pool",
      label: isWithdraw
        ? t("earnDepositDetails.from")
        : t("earnDepositDetails.to"),
      value: (
        <Text md medium primary testID={`${testIDPrefix}-pool`}>
          {getPositionPoolName(poolName, t)}
          <Text md medium secondary>
            {` · ${t("earnTokenPicker.protocolName")}`}
          </Text>
        </Text>
      ),
    },
    {
      key: "amount",
      label: isWithdraw
        ? t("earnDepositDetails.withdrew")
        : t("earnDepositDetails.deposited"),
      value:
        tokenAmount === null
          ? NO_FIAT_VALUE
          : formatTokenForDisplay(tokenAmount, tokenCode),
      testID: `${testIDPrefix}-amount`,
    },
  ];

  const statusRows: EarnDetailsRow[] = [
    {
      key: "status",
      label: t("transactionDetailsBottomSheet.status"),
      value: t("transactionDetailsBottomSheet.statusSuccess"),
      testID: `${testIDPrefix}-status`,
    },
    {
      key: "fee",
      label: t("earnDepositDetails.fee"),
      value: onChainDetails
        ? formatTokenForDisplay(
            stroopToXlm(onChainDetails.fee).toString(),
            NATIVE_TOKEN_CODE,
          )
        : NO_FIAT_VALUE,
      testID: `${testIDPrefix}-fee`,
    },
  ];

  return (
    <View className="gap-[24px]" testID={`${testIDPrefix}-sheet`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-center gap-[16px]">
          {token && <TokenIcon token={token} size="lg" />}
          <View className="flex-1">
            <Text lg semiBold primary numberOfLines={1}>
              {isWithdraw
                ? t("earnDepositDetails.withdrawTitle", { tokenCode })
                : t("earnDepositDetails.title", { tokenCode })}
            </Text>
            <Text sm medium secondary testID={`${testIDPrefix}-date`}>
              {date ? formatTransactionDate(date) : NO_FIAT_VALUE}
            </Text>
          </View>
        </View>
        <BottomSheetCloseButton
          onPress={onClose}
          testID={`${testIDPrefix}-close`}
        />
      </View>

      <View className="gap-[12px]">
        <EarnDetailsCard rows={destinationRows} />
        <EarnDetailsCard rows={statusRows} />

        {transactionDetails && (
          <TouchableOpacity
            onPress={handleViewTransactionDetails}
            className="flex-row items-center gap-[4px] rounded-[16px] border border-gray-5 bg-background-primary px-[16px] py-[12px]"
            testID={`${testIDPrefix}-transaction-details`}
          >
            <Icon.List size={16} color={themeColors.foreground.primary} />
            <Text md semiBold primary>
              {t("earnReview.transactionDetails")}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {transactionHash && (
        <Button
          secondary
          xl
          onPress={handleViewOnExplorer}
          icon={<Icon.LinkExternal01 size={18} />}
          iconPosition={IconPosition.RIGHT}
          testID={`${testIDPrefix}-view-on-explorer`}
        >
          {t("transactionDetailsBottomSheet.viewOnExpert")}
        </Button>
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

export default EarnDepositDetailsBottomSheet;
