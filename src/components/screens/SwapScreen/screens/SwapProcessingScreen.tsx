import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { TokenIcon } from "components/TokenIcon";
import { BaseLayout } from "components/layout/BaseLayout";
import SwapTransactionDetailsBottomSheet from "components/screens/SwapScreen/components/SwapTransactionDetailsBottomSheet";
import { SwapStatus } from "components/screens/SwapScreen/helpers";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { NonNativeToken, NativeToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { formatTokenDisplayAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { View } from "react-native";
import { getTransactionDetails, TransactionDetail } from "services/stellar";

export interface SwapProcessingScreenProps {
  onClose?: () => void;
  sourceAmount: string;
  sourceToken: NonNativeToken | NativeToken;
  destinationAmount: string;
  destinationToken: NonNativeToken | NativeToken;
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

  const [status, setStatus] = useState<SwapStatus>(SwapStatus.SWAPPING);
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetail | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(
    () => () =>
      navigation.setOptions({
        headerShown: true,
      }),
    [navigation],
  );

  useEffect(() => {
    if (transactionError) {
      setStatus(SwapStatus.FAILED);
    } else if (transactionHash && transactionDetails) {
      setStatus(SwapStatus.SWAPPED);
    } else if (isSubmitting) {
      setStatus(SwapStatus.SWAPPING);
    }
  }, [transactionHash, transactionError, isSubmitting, transactionDetails]);

  // Fetch actual transaction details when we have a hash
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
            "SwapProcessingScreen",
            "Failed to fetch transaction details",
            error,
            transactionHash,
          );
        });
    }
  }, [transactionHash, network, transactionDetails]);

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
        return <Icon.XCircle size={48} themeColor="red" />;
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
    const defaultData = {
      sourceAmount,
      sourceToken,
      destinationAmount,
      destinationToken,
    };

    if (
      transactionDetails &&
      transactionDetails.swapDetails &&
      status === SwapStatus.SWAPPED
    ) {
      const { swapDetails } = transactionDetails;

      return {
        ...defaultData,
        sourceAmount: swapDetails.sourceAmount,
        destinationAmount: swapDetails.destinationAmount,
      };
    }

    return defaultData;
  }, [
    transactionDetails,
    status,
    sourceAmount,
    sourceToken,
    destinationAmount,
    destinationToken,
  ]);

  const shouldShowDestinationAmount = useMemo(
    () =>
      status === SwapStatus.SWAPPED &&
      transactionDetails &&
      transactionDetails.swapDetails,
    [status, transactionDetails],
  );

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
                <TokenIcon token={displayData.sourceToken} size="lg" />
                <Icon.ChevronRightDouble
                  size={16}
                  color={themeColors.text.secondary}
                />
                <TokenIcon token={displayData.destinationToken} size="lg" />
              </View>

              <View className="items-center">
                <View className="flex-column flex-wrap items-center justify-center min-h-14">
                  <Text xl medium primary>
                    {formatTokenDisplayAmount(
                      displayData.sourceAmount,
                      displayData.sourceToken.code,
                    )}
                  </Text>
                  <Text lg medium secondary>
                    {getMessageText()}
                  </Text>
                  {shouldShowDestinationAmount ? (
                    <Text xl medium primary>
                      {formatTokenDisplayAmount(
                        displayData.destinationAmount,
                        displayData.destinationToken.code,
                      )}
                    </Text>
                  ) : (
                    <Text xl medium primary>
                      {displayData.destinationToken.code}
                    </Text>
                  )}
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
            transactionDetails={transactionDetails}
          />
        }
      />
    </BaseLayout>
  );
};

export default SwapProcessingScreen;
