import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { BottomSheetCloseButton } from "components/BottomSheetHeader";
import { TokenIcon } from "components/TokenIcon";
import {
  EarnDetailsCard,
  EarnDetailsRow,
} from "components/screens/EarnScreen/components/EarnDetailsCard";
import { getPoolDisplayName } from "components/screens/EarnScreen/helpers/poolDisplayName";
import SignTransactionDetailsBottomSheet, {
  SignTransactionDetailsHeader,
} from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  NATIVE_TOKEN_CODE,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { getBalanceByContractId } from "helpers/balances";
import { formatTransactionDate } from "helpers/date";
import { formatTokenForDisplay, stroopToXlm } from "helpers/formatAmount";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TouchableOpacity, View } from "react-native";
import { getTransactionDetails, TransactionDetail } from "services/stellar";

export interface EarnDepositDetailsBottomSheetProps {
  /** The deposited amount, in display (non-raw) units. */
  tokenAmount: string;
  /** The submitted deposit's hash. */
  transactionHash: string | null;
  onClose: () => void;
}

/**
 * The receipt for a completed deposit, opened from "View transaction" on the
 * success screen: where it went, how much, its status and the fee actually
 * charged, with the full decoded transaction one tap away and a link to
 * stellar.expert.
 *
 * The date and fee come from the network once the hash is known; until then
 * they read "--".
 */
export const EarnDepositDetailsBottomSheet: React.FC<
  EarnDepositDetailsBottomSheetProps
> = ({ tokenAmount, transactionHash, onClose }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { network } = useAuthenticationStore();
  const { pricedBalances } = useBalancesStore();
  const { open: openInAppBrowser } = useInAppBrowser();

  const selectedAssetId = useEarnStore((state) => state.selectedAssetId);
  const selectedAssetCode = useEarnStore((state) => state.selectedAssetCode);
  const pool = useEarnStore((state) => state.pool);

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const depositBalance = useMemo(
    () =>
      getBalanceByContractId(selectedAssetId, pricedBalances, networkDetails),
    [selectedAssetId, pricedBalances, networkDetails],
  );

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
          "Failed to get the deposit's details",
          error,
        );
      });
  }, [transactionHash, network]);

  // The full decoded transaction, the same sheet the review offers.
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

  const handleViewOnExplorer = useCallback(() => {
    if (!transactionHash) {
      return;
    }
    const explorerUrl = `${getStellarExpertUrl(network)}/tx/${transactionHash}`;
    openInAppBrowser(explorerUrl).catch((err) =>
      logger.error(
        "EarnDepositDetailsBottomSheet",
        "Error opening transaction explorer",
        err,
      ),
    );
  }, [transactionHash, network, openInAppBrowser]);

  const destinationRows: EarnDetailsRow[] = [
    {
      key: "to",
      label: t("earnDepositDetails.to"),
      value: (
        <Text md medium primary testID="earn-deposit-details-pool">
          {pool?.name ? getPoolDisplayName(pool.name, t) : "--"}
          <Text md medium secondary>
            {` · ${t("earnTokenPicker.protocolName")}`}
          </Text>
        </Text>
      ),
    },
    {
      key: "deposited",
      label: t("earnDepositDetails.deposited"),
      value: `-${formatTokenForDisplay(tokenAmount || "0", selectedAssetCode)}`,
      testID: "earn-deposit-details-amount",
    },
  ];

  const statusRows: EarnDetailsRow[] = [
    {
      key: "status",
      label: t("transactionDetailsBottomSheet.status"),
      value: t("transactionDetailsBottomSheet.statusSuccess"),
      testID: "earn-deposit-details-status",
    },
    {
      key: "fee",
      label: t("earnDepositDetails.fee"),
      value: onChainDetails
        ? formatTokenForDisplay(
            stroopToXlm(onChainDetails.fee).toString(),
            NATIVE_TOKEN_CODE,
          )
        : "--",
      testID: "earn-deposit-details-fee",
    },
  ];

  return (
    <View className="gap-[24px]" testID="earn-deposit-details-sheet">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-center gap-[16px]">
          {depositBalance && <TokenIcon token={depositBalance} size="lg" />}
          <View className="flex-1">
            <Text lg semiBold primary numberOfLines={1}>
              {t("earnDepositDetails.title", { tokenCode: selectedAssetCode })}
            </Text>
            <Text sm medium secondary>
              {onChainDetails
                ? formatTransactionDate(onChainDetails.createdAt)
                : "--"}
            </Text>
          </View>
        </View>
        <BottomSheetCloseButton
          onPress={onClose}
          testID="earn-deposit-details-close"
        />
      </View>

      <View className="gap-[12px]">
        <EarnDetailsCard rows={destinationRows} />
        <EarnDetailsCard rows={statusRows} />

        {transactionDetails && (
          <TouchableOpacity
            onPress={() => transactionDetailsSheetRef.current?.present()}
            className="flex-row items-center gap-[4px] rounded-[16px] border border-gray-5 bg-background-primary px-[16px] py-[12px]"
            testID="earn-deposit-details-transaction-details"
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
          testID="earn-deposit-details-view-on-explorer"
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
