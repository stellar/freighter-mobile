import { AssetIcon } from "components/AssetIcon";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AssetToken, NativeToken } from "config/types";
import { formatAssetAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

const SwapStatus = {
  SWAPPING: "swapping",
  SWAPPED: "swapped",
  FAILED: "failed",
} as const;

type SwapStatusType = (typeof SwapStatus)[keyof typeof SwapStatus];

export interface SwapProcessingScreenProps {
  onClose?: () => void;
  fromAmount: string;
  fromToken: AssetToken | NativeToken;
  toAmount: string;
  toToken: AssetToken | NativeToken;
}

/**
 * SwapProcessingScreen Component
 *
 * A screen for displaying swap processing status and results.
 * Shows the progress and outcome of token swaps.
 */
const SwapProcessingScreen: React.FC<SwapProcessingScreenProps> = ({
  onClose,
  fromAmount,
  fromToken,
  toAmount,
  toToken,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [status, setStatus] = useState<SwapStatusType>(SwapStatus.SWAPPING);

  // Mock the swap process - in real implementation this would come from swap store
  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus(SwapStatus.SWAPPED);
    }, 3000); // Simulate 3 second swap

    return () => clearTimeout(timer);
  }, []);

  const getStatusText = () => {
    switch (status) {
      case SwapStatus.SWAPPED:
        return t("swapProcessingScreen.swapped", { defaultValue: "Swapped!" });
      case SwapStatus.FAILED:
        return t("swapProcessingScreen.failed", { defaultValue: "Failed" });
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
            <Button secondary xl onPress={() => {}}>
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
    </BaseLayout>
  );
};

export default SwapProcessingScreen;
