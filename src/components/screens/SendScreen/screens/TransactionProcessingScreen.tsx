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
import { PricedBalance } from "config/types";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatAssetAmount } from "helpers/formatAmount";
import { isContractId } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

type TransactionStatus = "sending" | "sent" | "failed" | "unsupported";

type TransactionProcessingScreenProps = {
  selectedBalance: PricedBalance | undefined;
  tokenValue: string;
  onClose: () => void;
  isSubmitting?: boolean;
  transactionHash?: string | null;
  error?: string | null;
};

const TransactionProcessingScreen: React.FC<
  TransactionProcessingScreenProps
> = ({
  selectedBalance,
  tokenValue,
  onClose,
  isSubmitting = false,
  transactionHash = null,
  error = null,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const navigation = useNavigation();
  const { recipientAddress } = useTransactionSettingsStore();
  const slicedAddress = truncateAddress(recipientAddress, 4, 4);
  const [status, setStatus] = useState<TransactionStatus>("sending");
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const isContractAddress = isContractId(recipientAddress);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Determine transaction status based on props
  useEffect(() => {
    if (error) {
      setStatus("failed");
    } else if (transactionHash) {
      setStatus("sent");
    } else if (isContractAddress && !isSubmitting) {
      setStatus("unsupported");
    } else if (!isSubmitting) {
      // Demo mode - auto complete after 2 seconds
      const timer = setTimeout(() => {
        setStatus("sent");
      }, 2000);
      return () => clearTimeout(timer);
    }
    // If still submitting, keep status as "sending"
    return undefined;
  }, [isSubmitting, transactionHash, error, isContractAddress]);

  const handleClose = () => {
    onClose();
  };

  const handleViewTransaction = () => {
    bottomSheetModalRef.current?.present();
  };

  const getStatusText = () => {
    switch (status) {
      case "sent":
        return t("transactionProcessingScreen.sent");
      case "failed":
        return "Failed";
      case "unsupported":
        return "Not Supported";
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
      return "could not be sent to";
    }
    return t("transactionProcessingScreen.to");
  };

  const renderErrorMessage = () => {
    if (status === "failed" && error) {
      return (
        <View className="mt-6 rounded-[8px] bg-red-100 p-3">
          <Text sm medium className="text-red-800">
            {error}
          </Text>
        </View>
      );
    }

    return null;
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
                    {formatAssetAmount(tokenValue, selectedBalance?.tokenCode)}
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

            {renderErrorMessage()}
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
            selectedBalance={selectedBalance}
            tokenAmount={tokenValue}
            address={recipientAddress}
          />
        }
      />
    </BaseLayout>
  );
};

export default TransactionProcessingScreen;
