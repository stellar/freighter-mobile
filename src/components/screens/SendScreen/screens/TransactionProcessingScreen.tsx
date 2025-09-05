import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { TokenIcon } from "components/TokenIcon";
import TransactionDetailsBottomSheet from "components/TransactionDetailsBottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { TokenTypeWithCustomToken, PricedBalance } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatTokenAmount } from "helpers/formatAmount";
import { isContractId } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";

const TransactionStatus = {
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed",
  UNSUPPORTED: "unsupported",
} as const;

type TransactionStatusType =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export interface TransactionProcessingScreenProps {
  onClose?: () => void;
  transactionAmount: string;
  selectedBalance:
    | (PricedBalance & { id: string; tokenType: TokenTypeWithCustomToken })
    | undefined;
}

/**
 * TransactionProcessingScreen Component
 *
 * A screen for displaying transaction processing status and results.
 * Uses transaction stores to track status and data.
 */
const TransactionProcessingScreen: React.FC<
  TransactionProcessingScreenProps
> = ({ onClose, transactionAmount, selectedBalance }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const navigation = useNavigation();
  const { network } = useAuthenticationStore();

  const { recipientAddress } = useTransactionSettingsStore();

  const {
    isSubmitting,
    transactionHash,
    error: transactionError,
    resetTransaction,
  } = useTransactionBuilderStore();

  const { addRecentAddress } = useSendRecipientStore();

  const slicedAddress = truncateAddress(recipientAddress, 4, 4);
  const [status, setStatus] = useState<TransactionStatusType>(
    TransactionStatus.SENDING,
  );
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const isContractAddress = isContractId(recipientAddress);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (transactionError) {
      setStatus(TransactionStatus.FAILED);
    } else if (transactionHash) {
      setStatus(TransactionStatus.SENT);
      addRecentAddress(recipientAddress);
    } else if (isContractAddress && !isSubmitting) {
      setStatus(TransactionStatus.UNSUPPORTED);
    }

    return undefined;
  }, [
    isSubmitting,
    transactionHash,
    transactionError,
    isContractAddress,
    network,
    recipientAddress,
    addRecentAddress,
  ]);

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }

    resetTransaction();
  };

  const handleViewTransaction = () => {
    bottomSheetModalRef.current?.present();
  };

  const getStatusText = () => {
    switch (status) {
      case TransactionStatus.SENT:
        return t("transactionProcessingScreen.sent");
      case TransactionStatus.FAILED:
        return t("transactionProcessingScreen.failed");
      case TransactionStatus.UNSUPPORTED:
        return t("transactionProcessingScreen.unsupported");
      default:
        return t("transactionProcessingScreen.sending");
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case TransactionStatus.SENT:
        return (
          <Icon.CheckCircle size={48} color={themeColors.status.success} />
        );
      case TransactionStatus.FAILED:
        return <Icon.XCircle size={48} color={themeColors.status.error} />;
      case TransactionStatus.UNSUPPORTED:
        return (
          <Icon.AlertTriangle size={48} color={themeColors.status.warning} />
        );
      default:
        return <Spinner size="large" color={themeColors.base[1]} />;
    }
  };

  const getMessageText = () => {
    if (status === TransactionStatus.SENT) {
      return t("transactionProcessingScreen.wasSentTo");
    }

    if (
      status === TransactionStatus.FAILED ||
      status === TransactionStatus.UNSUPPORTED
    ) {
      return t("transactionProcessingScreen.couldNotBeSentTo");
    }

    return t("transactionProcessingScreen.to");
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 justify-between">
        <View className="flex-1 items-center justify-center">
          <View className="items-center gap-[8px] w-full">
            {getStatusIcon()}

            <Display xs medium>
              {getStatusText()}
            </Display>

            <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-secondary w-full">
              <View className="flex-row items-center justify-center gap-[16px]">
                {selectedBalance && (
                  <TokenIcon token={selectedBalance} size="lg" />
                )}
                <Icon.ChevronRightDouble
                  size={16}
                  color={themeColors.text.secondary}
                />
                <Avatar
                  size="lg"
                  publicAddress={recipientAddress}
                  hasDarkBackground
                />
              </View>

              <View className="items-center">
                <View className="flex-row flex-wrap items-center justify-center min-h-14">
                  <Text xl medium primary>
                    {formatTokenAmount(
                      transactionAmount,
                      selectedBalance?.tokenCode,
                    )}
                  </Text>
                  <Text lg medium secondary>
                    {getMessageText()}
                  </Text>
                  <Text xl medium primary>
                    {slicedAddress}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {status === TransactionStatus.SENT ? (
          <View className="gap-[16px]">
            <Button secondary xl onPress={handleViewTransaction}>
              {t("transactionProcessingScreen.viewTransaction")}
            </Button>
            <Button tertiary xl onPress={handleClose}>
              {t("common.done")}
            </Button>
          </View>
        ) : (
          <View className="gap-[16px]">
            <Text sm medium secondary textAlign="center">
              {t("transactionProcessingScreen.closeMessage")}
            </Text>
            <Button secondary xl onPress={handleClose}>
              {t("common.close")}
            </Button>
          </View>
        )}
      </View>

      <BottomSheet
        modalRef={bottomSheetModalRef}
        handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
        customContent={
          <TransactionDetailsBottomSheet
            transactionAmount={transactionAmount}
          />
        }
      />
    </BaseLayout>
  );
};

export default TransactionProcessingScreen;
