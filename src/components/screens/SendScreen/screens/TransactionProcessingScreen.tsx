import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { AssetIcon } from "components/AssetIcon";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import TransactionDetailsBottomSheet from "components/TransactionDetailsBottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AssetTypeWithCustomToken, PricedBalance } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatAssetAmount } from "helpers/formatAmount";
import { isContractId } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

type TransactionStatus = "sending" | "sent" | "failed" | "unsupported";

export interface TransactionProcessingScreenProps {
  onClose?: () => void;
  transactionAmount: string;
  selectedBalance:
    | (PricedBalance & { id: string; assetType: AssetTypeWithCustomToken })
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

  const slicedAddress = truncateAddress(recipientAddress, 4, 4);
  const [status, setStatus] = useState<TransactionStatus>("sending");
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const isContractAddress = isContractId(recipientAddress);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (transactionError) {
      setStatus("failed");
    } else if (transactionHash) {
      setStatus("sent");
    } else if (isContractAddress && !isSubmitting) {
      setStatus("unsupported");
    }

    return undefined;
  }, [
    isSubmitting,
    transactionHash,
    transactionError,
    isContractAddress,
    network,
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
      case "sent":
        return t("transactionProcessingScreen.sent");
      case "failed":
        return t("transactionProcessingScreen.failed", "Failed");
      case "unsupported":
        return t("transactionProcessingScreen.unsupported", "Not Supported");
      default:
        return t("transactionProcessingScreen.sending");
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "sent":
        return (
          <Icon.CheckCircle size={48} color={themeColors.status.success} />
        );
      case "failed":
        return <Icon.XCircle size={48} color={themeColors.status.error} />;
      case "unsupported":
        return (
          <Icon.AlertTriangle size={48} color={themeColors.status.warning} />
        );
      default:
        return <Spinner size="large" color={themeColors.base[1]} />;
    }
  };

  const getMessageText = () => {
    if (status === "sent") {
      return t("transactionProcessingScreen.wasSentTo");
    }

    if (status === "failed" || status === "unsupported") {
      return t(
        "transactionProcessingScreen.couldNotBeSentTo",
        "could not be sent to",
      );
    }

    return t("transactionProcessingScreen.to");
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 justify-between">
        <View className="flex-1 items-center justify-center">
          <View className="items-center gap-[8px]">
            {getStatusIcon()}

            <Display xs medium>
              {getStatusText()}
            </Display>

            <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-secondary">
              <View className="flex-row items-center justify-center gap-[16px]">
                {selectedBalance && (
                  <AssetIcon token={selectedBalance} size="lg" />
                )}
                <Icon.ChevronRightDouble
                  size={16}
                  color={themeColors.text.secondary}
                />
                <Avatar size="lg" publicAddress={recipientAddress} />
              </View>

              <View className="items-center">
                <View className="flex-row flex-wrap items-center justify-center">
                  <Text xl medium primary>
                    {formatAssetAmount(
                      transactionAmount,
                      selectedBalance?.tokenCode,
                    )}
                  </Text>
                  <Text lg medium secondary>
                    {` ${getMessageText()} `}
                  </Text>
                  <Text xl medium primary>
                    {slicedAddress}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {status === "sent" ? (
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
