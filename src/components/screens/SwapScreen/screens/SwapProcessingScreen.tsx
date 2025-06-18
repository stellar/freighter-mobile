import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { AssetIcon } from "components/AssetIcon";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import SwapTransactionDetailsBottomSheet from "components/screens/SwapScreen/components/SwapTransactionDetailsBottomSheet";
import { SwapStatus } from "components/screens/SwapScreen/helpers";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AssetToken, NativeToken } from "config/types";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { formatAssetAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

export interface SwapProcessingScreenProps {
  onClose?: () => void;
  fromAmount: string;
  fromToken: AssetToken | NativeToken;
  toAmount: string;
  toToken: AssetToken | NativeToken;
}

const SwapProcessingScreen: React.FC<SwapProcessingScreenProps> = ({
  onClose,
  fromAmount,
  fromToken,
  toAmount,
  toToken,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const transactionDetailsBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const {
    transactionHash,
    error: transactionError,
    isSubmitting,
  } = useTransactionBuilderStore();

  const [status, setStatus] = useState<SwapStatus>(SwapStatus.SWAPPING);

  useEffect(() => {
    if (transactionError) {
      setStatus(SwapStatus.FAILED);
    } else if (transactionHash) {
      setStatus(SwapStatus.SWAPPED);
    } else if (isSubmitting) {
      setStatus(SwapStatus.SWAPPING);
    }
    // Note: No default case needed - status stays as SWAPPING until conditions are met
  }, [transactionHash, transactionError, isSubmitting]);

  const getStatusText = () => {
    switch (status) {
      case SwapStatus.SWAPPED:
        return t("swapProcessingScreen.swapped", { defaultValue: "Swapped!" });
      case SwapStatus.FAILED:
        return t("swapProcessingScreen.failed", { defaultValue: "Failed" });
      case SwapStatus.SWAPPING:
      default:
        return t("swapProcessingScreen.swapping", { defaultValue: "Swapping" });
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case SwapStatus.SWAPPED:
        return (
          <Icon.CheckCircle size={48} color={themeColors.status.success} />
        );
      case SwapStatus.FAILED:
        return <Icon.XCircle size={48} color={themeColors.status.error} />;
      case SwapStatus.SWAPPING:
      default:
        return <Spinner size="large" color={themeColors.base[1]} />;
    }
  };

  const getMessageText = () => {
    if (status === SwapStatus.SWAPPED) {
      return t("swapProcessingScreen.wasSwappedFor", {
        defaultValue: " was swapped for ",
      });
    }
    if (status === SwapStatus.FAILED) {
      return t("swapProcessingScreen.couldNotBeSwappedFor", {
        defaultValue: " could not be swapped for ",
      });
    }
    return t("swapProcessingScreen.to", { defaultValue: " to " });
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

            <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-tertiary w-full">
              <View className="flex-row items-center justify-center gap-[16px]">
                <AssetIcon token={fromToken} size="lg" />
                <Icon.ChevronRightDouble
                  size={16}
                  color={themeColors.text.secondary}
                />
                <AssetIcon token={toToken} size="lg" />
              </View>

              <View className="items-center">
                <View className="flex-row flex-wrap items-center justify-center min-h-14">
                  <Text xl medium primary>
                    {formatAssetAmount(fromAmount, fromToken.code)}
                  </Text>
                  <Text lg medium secondary>
                    {getMessageText()}
                  </Text>
                  <Text xl medium primary>
                    {formatAssetAmount(toAmount, toToken.code)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {status === SwapStatus.SWAPPED ? (
          <View className="gap-[16px]">
            <Button
              secondary
              xl
              onPress={() =>
                transactionDetailsBottomSheetModalRef.current?.present()
              }
            >
              {t("swapProcessingScreen.viewTransaction", {
                defaultValue: "View transaction",
              })}
            </Button>
            <Button tertiary xl onPress={onClose}>
              {t("common.done")}
            </Button>
          </View>
        ) : (
          <View className="gap-[16px]">
            <Text sm medium secondary textAlign="center">
              {t("swapProcessingScreen.closeMessage", {
                defaultValue:
                  "You can close this screen, your transaction should be complete in less than a minute",
              })}
            </Text>
            <Button secondary xl onPress={onClose}>
              {t("common.close")}
            </Button>
          </View>
        )}
      </View>

      <BottomSheet
        modalRef={transactionDetailsBottomSheetModalRef}
        handleCloseModal={() =>
          transactionDetailsBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <SwapTransactionDetailsBottomSheet
            fromAmount={fromAmount}
            fromToken={fromToken}
            toAmount={toAmount}
            toToken={toToken}
          />
        }
      />
    </BaseLayout>
  );
};

export default SwapProcessingScreen;
