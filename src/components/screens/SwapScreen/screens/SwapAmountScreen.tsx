/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import ContextMenuButton from "components/ContextMenuButton";
import NumericKeyboard from "components/NumericKeyboard";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  SelectTokenBottomSheet,
  SwapReviewBottomSheet,
} from "components/screens/SwapScreen/components";
import { useSwapAmountScreen } from "components/screens/SwapScreen/hooks/useSwapAmountScreen";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Notification } from "components/sds/Notification";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_DECIMALS } from "config/constants";
import { logger } from "config/logger";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { formatAssetAmount } from "helpers/formatAmount";
import { formatNumericInput } from "helpers/numericInput";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useToast } from "providers/ToastProvider";
import React, { useEffect, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";

type SwapAmountScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
>;

/**
 * SwapAmountScreen Component
 *
 * Displays the swap amount input interface where users can:
 * - Input the amount to swap
 * - Select the destination token
 * - Review and confirm the swap
 *
 * This component focuses purely on UI rendering and delegates all business logic
 * to the useSwapAmountScreen hook for better separation of concerns.
 */
const SwapAmountScreen: React.FC<SwapAmountScreenProps> = ({
  navigation,
  route,
}) => {
  const { tokenId: swapFromTokenId, tokenSymbol: swapFromTokenSymbol } =
    route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { showToast } = useToast();

  // UI state
  const selectTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Use the comprehensive hook that handles all business logic
  const {
    // State
    isProcessing,
    amountError,
    swapAmount,
    destinationAmount,
    fromTokenSymbol,
    toTokenSymbol,
    swapFromTokenBalance,
    swapToTokenBalance,
    pathResult,
    isLoadingPath,
    pathError,
    network,

    // Actions
    setSwapAmount,
    handleTokenSelect: onTokenSelect,
    handleSetMax,
    executeSwap,
    prepareSwapTransaction,
    handleProcessingScreenClose,

    // UI state
    buttonText,
    isButtonDisabled,
    isButtonLoading,
    action,
    menuActions,

    // Processing tokens
    fromToken,
    toToken,
  } = useSwapAmountScreen({
    swapFromTokenId,
    swapFromTokenSymbol,
    navigation,
  });

  // Setup menu in header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <ContextMenuButton
          contextMenuProps={{
            actions: menuActions,
          }}
        >
          <Icon.Settings04 size={24} color={themeColors.base[1]} />
        </ContextMenuButton>
      ),
    });
  }, [navigation, menuActions, themeColors]);

  // Clear swap error when amount or path changes
  useEffect(() => {
    if (swapError) {
      setSwapError(null);
    }
  }, [swapAmount, pathResult, swapError]);

  // Enhanced handlers with error feedback
  const handleSelectSwapToToken = () => {
    selectTokenBottomSheetModalRef.current?.present();
  };

  const handleTokenSelect = (tokenId: string, tokenSymbol: string) => {
    onTokenSelect(tokenId, tokenSymbol);
    selectTokenBottomSheetModalRef.current?.dismiss();
  };

  const handleAmountChange = (key: string) => {
    const newAmount = formatNumericInput(swapAmount, key, DEFAULT_DECIMALS);
    setSwapAmount(newAmount);
  };

  const handleOpenReview = async () => {
    try {
      await prepareSwapTransaction();
      swapReviewBottomSheetModalRef.current?.present();
    } catch (error) {
      setSwapError("Failed to prepare swap transaction");
      showToast({
        variant: "error",
        title: t("common.error"),
        message: "Failed to prepare swap transaction",
      });
      logger.error(
        "SwapAmountScreen",
        "Failed to prepare swap transaction",
        error,
      );
    }
  };

  const handleConfirmSwap = () => {
    swapReviewBottomSheetModalRef.current?.dismiss();

    setTimeout(() => {
      executeSwap().catch((error) => {
        setSwapError("Swap transaction failed");
        showToast({
          variant: "error",
          title: t("common.error"),
          message: "Swap transaction failed",
        });
        logger.error("SwapAmountScreen", "Swap failed", error);
      });
    }, 100);
  };

  const handleMainButtonPress = () => {
    if (action === "selectAsset") {
      handleSelectSwapToToken();
    } else {
      handleOpenReview();
    }
  };

  const getRightContent = () => {
    if (isLoadingPath) {
      return <Spinner size="small" />;
    }
    if (pathResult) {
      return (
        <Text md medium>
          {formatAssetAmount(destinationAmount)}
        </Text>
      );
    }
    return (
      <Text md secondary>
        --
      </Text>
    );
  };

  // Show processing screen when swap is executing
  if (isProcessing) {
    return (
      <SwapProcessingScreen
        onClose={handleProcessingScreenClose}
        fromAmount={swapAmount}
        fromToken={fromToken}
        toAmount={destinationAmount || "0"}
        toToken={toToken}
      />
    );
  }

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <View className="flex-1">
        {/* Amount Display Section */}
        <View className="gap- items-center py-[32px] px-6">
          <View className="flex-row items-center gap-1">
            <Display lg medium>
              {swapAmount}
            </Display>
            <Text md medium secondary>
              {fromTokenSymbol}
            </Text>
          </View>
        </View>

        {/* Error Display Section */}
        {(amountError || pathError || swapError) && (
          <View className="mx-6 mb-4">
            <Notification
              variant="error"
              message={amountError || pathError || swapError || ""}
            />
          </View>
        )}

        {/* Token Selection Section */}
        <View className="gap-3 mt-[16px]">
          {/* From Token Row */}
          <View className="rounded-[12px] py-[12px] px-[16px] bg-background-tertiary">
            {swapFromTokenBalance && (
              <BalanceRow
                balance={swapFromTokenBalance}
                rightContent={
                  <Button secondary lg onPress={handleSetMax}>
                    {t("swapScreen.setMax")}
                  </Button>
                }
                isSingleRow
              />
            )}
          </View>

          {/* To Token Row */}
          <TouchableOpacity onPress={handleSelectSwapToToken}>
            <View className="rounded-[12px] py-[12px] px-[16px] bg-background-tertiary">
              {swapToTokenBalance ? (
                <BalanceRow
                  balance={swapToTokenBalance}
                  customTextContent={`${t("swapScreen.receive")} ${toTokenSymbol}`}
                  isSingleRow
                  rightContent={
                    <View className="items-end">{getRightContent()}</View>
                  }
                />
              ) : (
                <View className="flex-row items-center gap-4 h-[44px]">
                  <Icon.Plus
                    circle
                    size={26}
                    color={themeColors.foreground.primary}
                  />
                  <View className="flex-col">
                    <Text>{t("swapScreen.receive")}</Text>
                    <Text sm secondary>
                      {t("swapScreen.chooseAsset")}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Numeric Keyboard */}
        <View className="w-full mt-[56px] mb-[24px]">
          <NumericKeyboard onPress={handleAmountChange} />
        </View>

        {/* Action Button */}
        <View className="mt-auto mb-4">
          <Button
            tertiary
            xl
            onPress={handleMainButtonPress}
            disabled={isButtonDisabled}
            isLoading={isButtonLoading}
          >
            {buttonText}
          </Button>
        </View>
      </View>

      {/* Bottom Sheets */}
      <BottomSheet
        modalRef={selectTokenBottomSheetModalRef}
        handleCloseModal={() =>
          selectTokenBottomSheetModalRef.current?.dismiss()
        }
        snapPoints={["80%"]}
        customContent={
          <SelectTokenBottomSheet
            onTokenSelect={handleTokenSelect}
            customTitle={t("swapScreen.bottomSheetTokenListTitle")}
            title={t("swapScreen.swapTo")}
            onClose={() => selectTokenBottomSheetModalRef.current?.dismiss()}
            network={network}
          />
        }
      />

      <BottomSheet
        modalRef={swapReviewBottomSheetModalRef}
        handleCloseModal={() =>
          swapReviewBottomSheetModalRef.current?.dismiss()
        }
        snapPoints={["80%"]}
        customContent={
          <SwapReviewBottomSheet
            onCancel={() => swapReviewBottomSheetModalRef.current?.dismiss()}
            onConfirm={handleConfirmSwap}
          />
        }
      />
    </BaseLayout>
  );
};

export default SwapAmountScreen;
