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
import { SwapButtonAction } from "components/screens/SwapScreen/helpers";
import { useSwapAmountScreen } from "components/screens/SwapScreen/hooks";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Notification } from "components/sds/Notification";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_DECIMALS } from "config/constants";
import { logger } from "config/logger";
import {
  SWAP_ROUTES,
  SwapStackParamList,
} from "config/routes";
import { formatAssetAmount } from "helpers/formatAmount";
import { formatNumericInput } from "helpers/numericInput";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useRef } from "react";
import { TouchableOpacity, View } from "react-native";

type SwapAmountScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
>;

const SwapAmountScreen: React.FC<SwapAmountScreenProps> = ({
  navigation,
  route,
}) => {
  const { tokenId: swapFromTokenId, tokenSymbol: swapFromTokenSymbol } =
    route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  
  const selectTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);

  // Use the comprehensive hook for all swap logic
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
    handleTokenSelect,
    handleSetMax,
    executeSwap,
    prepareSwapTransaction,
    handleProcessingScreenClose,
    
    // UI state
    buttonText,
    isButtonDisabled,
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

  const handleSelectSwapToToken = () => {
    selectTokenBottomSheetModalRef.current?.present();
  };

  const handleTokenSelectWrapper = (tokenId: string, tokenSymbol: string) => {
    handleTokenSelect(tokenId, tokenSymbol);
    selectTokenBottomSheetModalRef.current?.dismiss();
  };

  const handleOpenReview = async () => {
    try {
      await prepareSwapTransaction();
      swapReviewBottomSheetModalRef.current?.present();
    } catch (error) {
      logger.error(
        "SwapAmountScreen",
        "Failed to prepare swap transaction:",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const handleConfirmSwap = () => {
    swapReviewBottomSheetModalRef.current?.dismiss();

    // Wait for the bottom sheet to dismiss before showing the processing screen
    setTimeout(() => {
      executeSwap();
    }, 100);
  };

  const handleAmountChange = (key: string) => {
    const newAmount = formatNumericInput(swapAmount, key, DEFAULT_DECIMALS);
    setSwapAmount(newAmount);
  };

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

  const handleMainButtonPress = () => {
    if (action === SwapButtonAction.SELECT_ASSET) {
      handleSelectSwapToToken();
    } else {
      handleOpenReview();
    }
  };

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
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
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

        {/* Error display */}
        {(amountError || pathError) && (
          <View className="mx-6 mb-4">
            <Notification
              variant="error"
              message={amountError || pathError || ""}
            />
          </View>
        )}

        <View className="gap-3 mt-[16px]">
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
          <TouchableOpacity onPress={handleSelectSwapToToken}>
            <View className="rounded-[12px] py-[12px] px-[16px] bg-background-tertiary">
              {swapToTokenBalance ? (
                <BalanceRow
                  balance={swapToTokenBalance}
                  customTextContent={`${t("swapScreen.receive")} ${toTokenSymbol}`}
                  isSingleRow
                  rightContent={
                    <View className="items-end">
                      {getRightContent()}
                    </View>
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

        <View className="w-full mt-[56px] mb-[24px]">
          <NumericKeyboard onPress={handleAmountChange} />
        </View>

        <View className="mt-auto mb-4">
          <Button
            tertiary
            xl
            onPress={handleMainButtonPress}
            disabled={isButtonDisabled}
          >
            {buttonText}
          </Button>
        </View>
      </View>

      <BottomSheet
        modalRef={selectTokenBottomSheetModalRef}
        handleCloseModal={() =>
          selectTokenBottomSheetModalRef.current?.dismiss()
        }
        snapPoints={["80%"]}
        customContent={
          <SelectTokenBottomSheet
            onTokenSelect={handleTokenSelectWrapper}
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
