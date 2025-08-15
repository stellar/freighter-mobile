import StellarLogo from "assets/logos/stellar-logo.svg";
import { BigNumber } from "bignumber.js";
import { TokenIcon } from "components/TokenIcon";
import Avatar from "components/sds/Avatar";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatTransactionDate } from "helpers/date";
import { formatTokenAmount, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useState } from "react";
import { View, Linking } from "react-native";
import { getTransactionDetails, TransactionDetail } from "services/stellar";

/**
 * TransactionDetailsBottomSheet props
 *
 * @prop {string} [transactionAmount] - Transaction amount
 */
type TransactionDetailsBottomSheetProps = {
  transactionAmount: string;
};

/**
 * TransactionDetailsBottomSheet Component
 *
 * A bottom sheet displaying transaction details, including amount, recipient,
 * status, fee, and other transaction metadata.
 *
 * Uses data from Zustand stores to show real transaction information.
 */
const TransactionDetailsBottomSheet: React.FC<
  TransactionDetailsBottomSheetProps
> = ({ transactionAmount }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();

  const { recipientAddress, selectedTokenId, transactionMemo, transactionFee } =
    useTransactionSettingsStore();

  const {
    transactionXDR,
    transactionHash,
    error: transactionError,
    isSubmitting,
  } = useTransactionBuilderStore();

  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const selectedBalance = balanceItems.find(
    (item) => item.id === selectedTokenId,
  );

  const slicedAddress = truncateAddress(recipientAddress, 4, 4);
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetail | null>(null);

  useEffect(() => {
    if (transactionHash) {
      getTransactionDetails(transactionHash, network)
        .then((details) => {
          if (details) {
            setTransactionDetails(details);
          }
        })
        .catch((error) => {
          logger.error(
            "TransactionDetailsBottomSheet",
            "Failed to get transaction details",
            error,
          );
        });
    }
  }, [transactionHash, network]);

  const getTransactionStatus = () => {
    if (transactionHash) {
      return {
        text: t("transactionDetailsBottomSheet.statusSuccess"),
        color: themeColors.status.success,
      };
    }
    if (transactionError) {
      return {
        text: t("transactionDetailsBottomSheet.statusFailed"),
        color: themeColors.status.error,
      };
    }
    if (isSubmitting) {
      return {
        text: t("transactionDetailsBottomSheet.statusPending"),
        color: themeColors.status.warning,
      };
    }
    return {
      text: t("transactionDetailsBottomSheet.statusSuccess"),
      color: themeColors.status.success,
    };
  };

  const transactionStatus = getTransactionStatus();

  const dateTimeDisplay = formatTransactionDate(transactionDetails?.createdAt);

  const handleCopyXdr = () => {
    if (transactionXDR) {
      copyToClipboard(transactionXDR, {
        notificationMessage: t("common.copied"),
      });
    }
  };

  const handleViewOnExplorer = () => {
    if (!transactionHash) return;

    const explorerUrl = `${getStellarExpertUrl(network)}/tx/${transactionHash}`;

    Linking.openURL(explorerUrl).catch((err) =>
      logger.error("Error opening transaction explorer:", String(err)),
    );
  };

  return (
    <View className="gap-[24px]">
      <View className="flex-row gap-[16px]">
        {selectedBalance && <TokenIcon token={selectedBalance} size="lg" />}
        <View>
          <Text md medium primary>
            {t("transactionDetailsBottomSheet.sent", {
              tokenCode: selectedBalance?.tokenCode,
            })}
          </Text>
          <View className="flex-row items-center gap-[4px]">
            <Icon.ArrowCircleUp size={16} color={themeColors.text.secondary} />
            <Text sm medium secondary>
              {dateTimeDisplay}
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-background-secondary rounded-[16px] p-[24px] gap-[12px]">
        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {formatTokenAmount(transactionAmount, selectedBalance?.tokenCode)}
            </Text>
            <Text md medium secondary>
              {selectedBalance?.currentPrice
                ? formatFiatAmount(
                    new BigNumber(transactionAmount).times(
                      selectedBalance.currentPrice,
                    ),
                  )
                : "--"}
            </Text>
          </View>
          {selectedBalance && <TokenIcon token={selectedBalance} size="lg" />}
        </View>

        <View>
          <View className="w-[32px] h-[32px] rounded-full bg-tertiary justify-center items-center border border-gray-6">
            <Icon.ChevronDownDouble
              size={20}
              color={themeColors.foreground.primary}
            />
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {slicedAddress}
            </Text>
          </View>
          <Avatar size="lg" publicAddress={recipientAddress} />
        </View>
      </View>

      <View className="rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.ClockCheck size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionDetailsBottomSheet.status")}
            </Text>
          </View>
          <Text md medium color={transactionStatus.color}>
            {transactionStatus.text}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.File02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.memo")}
            </Text>
          </View>
          <Text md medium secondary={!transactionMemo}>
            {transactionMemo || t("common.none")}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.fee")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[4px]">
            <StellarLogo width={16} height={16} />
            <Text md medium>
              {formatTokenAmount(transactionFee, NATIVE_TOKEN_CODE)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.xdr")}
            </Text>
          </View>
          <View
            className="flex-row items-center gap-[8px]"
            onTouchEnd={handleCopyXdr}
          >
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text md medium>
              {transactionXDR
                ? truncateAddress(transactionXDR, 10, 4)
                : t("common.none")}
            </Text>
          </View>
        </View>
      </View>

      {transactionHash && (
        <Button
          tertiary
          lg
          onPress={handleViewOnExplorer}
          icon={
            <Icon.LinkExternal01
              size={16}
              color={themeColors.foreground.primary}
            />
          }
          iconPosition={IconPosition.RIGHT}
        >
          {t("transactionDetailsBottomSheet.viewOnExpert")}
        </Button>
      )}
    </View>
  );
};

export default TransactionDetailsBottomSheet;
