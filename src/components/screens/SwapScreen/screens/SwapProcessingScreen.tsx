import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { AssetIcon } from "components/AssetIcon";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import SwapTransactionDetailsBottomSheet from "components/screens/SwapScreen/components/SwapTransactionDetailsBottomSheet";
import { SwapStatus } from "components/screens/SwapScreen/helpers";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { logger } from "config/logger";
import {
  AssetToken,
  NativeToken,
  AssetTypeWithCustomToken,
} from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { formatAssetAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { View } from "react-native";
import { getTransactionDetails, TransactionDetail } from "services/stellar";

export interface SwapProcessingScreenProps {
  onClose?: () => void;
  sourceAmount: string;
  sourceToken: AssetToken | NativeToken;
  destinationAmount: string;
  destinationToken: AssetToken | NativeToken;
}

const SwapProcessingScreen: React.FC<SwapProcessingScreenProps> = ({
  onClose,
  sourceAmount,
  sourceToken,
  destinationAmount,
  destinationToken,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { network } = useAuthenticationStore();
  const transactionDetailsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const navigation = useNavigation();
  const {
    transactionHash,
    error: transactionError,
    isSubmitting,
  } = useTransactionBuilderStore();

  const preservedSwapData = useMemo(
    () => ({
      sourceAmount,
      sourceToken,
      destinationAmount,
      destinationToken,
    }),
    [sourceAmount, sourceToken, destinationAmount, destinationToken],
  );

  const [status, setStatus] = useState<SwapStatus>(SwapStatus.SWAPPING);
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetail | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (transactionError) {
      setStatus(SwapStatus.FAILED);
    } else if (transactionHash) {
      setStatus(SwapStatus.SWAPPED);
    } else if (isSubmitting) {
      setStatus(SwapStatus.SWAPPING);
    }
  }, [transactionHash, transactionError, isSubmitting]);

  // Fetch actual transaction details when we have a hash
  useEffect(() => {
    if (transactionHash && status === SwapStatus.SWAPPED) {
      getTransactionDetails(transactionHash, network)
        .then((details) => {
          if (details) {
            setTransactionDetails(details);
          }
        })
        .catch((error) => {
          logger.error(
            "SwapProcessingScreen",
            "Failed to fetch transaction details",
            {
              error: error instanceof Error ? error.message : String(error),
              transactionHash,
            },
          );
        });
    }
  }, [transactionHash, network, status]);

  const getStatusText = () => {
    switch (status) {
      case SwapStatus.SWAPPED:
        return t("swapProcessingScreen.swapped");
      case SwapStatus.FAILED:
        return t("swapProcessingScreen.failed");
      case SwapStatus.SWAPPING:
      default:
        return t("swapProcessingScreen.swapping");
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
      return t("swapProcessingScreen.wasSwappedFor");
    }
    if (status === SwapStatus.FAILED) {
      return t("swapProcessingScreen.couldNotBeSwappedFor");
    }
    return t("swapProcessingScreen.to");
  };

  const displayData = useMemo(() => {
    if (
      transactionDetails &&
      transactionDetails.swapDetails &&
      status === SwapStatus.SWAPPED
    ) {
      const { swapDetails } = transactionDetails;
      return {
        sourceAmount: swapDetails.sourceAmount,
        sourceToken: {
          code: swapDetails.sourceAssetCode,
          issuer: { key: swapDetails.sourceAssetIssuer },
          type: swapDetails.sourceAssetType as AssetTypeWithCustomToken,
        } as AssetToken | NativeToken,
        destinationAmount: swapDetails.destinationAmount,
        destinationToken: {
          code: swapDetails.destinationAssetCode,
          issuer: { key: swapDetails.destinationAssetIssuer },
          type: swapDetails.destinationAssetType as AssetTypeWithCustomToken,
        } as AssetToken | NativeToken,
      };
    }
    return preservedSwapData;
  }, [transactionDetails, status, preservedSwapData]);

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 justify-between">
        <View className="flex-1 items-center justify-center">
          <View className="items-center gap-[8px] w-full">
            {getStatusIcon()}

            <View className="mb-2">
              <Display xs medium>
                {getStatusText()}
              </Display>
            </View>

            <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-tertiary w-full">
              <View className="flex-row items-center justify-center gap-[16px]">
                <AssetIcon token={displayData.sourceToken} size="lg" />
                <Icon.ChevronRightDouble
                  size={16}
                  color={themeColors.text.secondary}
                />
                <AssetIcon token={displayData.destinationToken} size="lg" />
              </View>

              <View className="items-center">
                <View className="flex-column flex-wrap items-center justify-center min-h-14">
                  <Text xl medium primary>
                    {formatAssetAmount(
                      displayData.sourceAmount,
                      displayData.sourceToken.code,
                    )}
                  </Text>
                  <Text lg medium secondary>
                    {getMessageText()}
                  </Text>
                  <Text xl medium primary>
                    {formatAssetAmount(
                      displayData.destinationAmount,
                      displayData.destinationToken.code,
                    )}
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
              {t("swapProcessingScreen.viewTransaction")}
            </Button>
            <Button tertiary xl onPress={onClose}>
              {t("common.done")}
            </Button>
          </View>
        ) : (
          <View className="gap-[16px]">
            <Text sm medium secondary textAlign="center">
              {t("swapProcessingScreen.closeMessage")}
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
            sourceAmount={displayData.sourceAmount}
            sourceToken={displayData.sourceToken}
            destinationAmount={displayData.destinationAmount}
            destinationToken={displayData.destinationToken}
          />
        }
      />
    </BaseLayout>
  );
};

export default SwapProcessingScreen;
