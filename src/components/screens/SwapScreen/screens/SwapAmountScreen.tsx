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
import { createSwapMenuActions } from "components/screens/SwapScreen/helpers";
import { useSwapPathFinding } from "components/screens/SwapScreen/hooks";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Notification } from "components/sds/Notification";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_DECIMALS } from "config/constants";
import { logger } from "config/logger";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { calculateSpendableAmount, isAmountSpendable } from "helpers/balances";
import { formatAssetAmount } from "helpers/formatAmount";
import { formatNumericInput } from "helpers/numericInput";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
 * This component follows the same clean pattern as TransactionAmountScreen,
 * using focused hooks and keeping business logic close to where it's used.
 */
const SwapAmountScreen: React.FC<SwapAmountScreenProps> = ({
  navigation,
  route,
}) => {
  const { tokenId: swapFromTokenId, tokenSymbol: swapFromTokenSymbol } =
    route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { swapFee, swapTimeout, swapSlippage } = useSwapSettingsStore();
  const { isBuilding } = useTransactionBuilderStore();

  // UI state
  const selectTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Get balances
  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });

  // Swap store state and actions
  const {
    fromTokenId,
    toTokenId,
    fromTokenSymbol,
    toTokenSymbol,
    swapAmount,
    destinationAmount,
    pathResult,
    isLoadingPath,
    pathError,
    setFromToken,
    setToToken,
    setSwapAmount,
    resetSwap,
  } = useSwapStore();

  // Get token balances
  const swapFromTokenBalance = balanceItems.find(
    (item) => item.id === fromTokenId,
  );
  const swapToTokenBalance = balanceItems.find((item) => item.id === toTokenId);

  // Amount validation logic - inline instead of separate hook
  useEffect(() => {
    if (!swapFromTokenBalance || !swapAmount || swapAmount === "0") {
      setAmountError(null);
      return;
    }

    if (
      !isAmountSpendable(
        swapAmount,
        swapFromTokenBalance,
        account?.subentryCount,
        swapFee,
      )
    ) {
      const spendableAmount = calculateSpendableAmount(
        swapFromTokenBalance,
        account?.subentryCount || 0,
        swapFee,
      );
      setAmountError(
        t("swapScreen.errors.insufficientBalance", {
          amount: spendableAmount.toFixed(),
          symbol: fromTokenSymbol,
        }),
      );
    } else {
      setAmountError(null);
    }
  }, [
    swapAmount,
    swapFromTokenBalance,
    account?.subentryCount,
    fromTokenSymbol,
    swapFee,
    t,
  ]);

  useSwapPathFinding({
    swapFromTokenBalance,
    swapToTokenBalance,
    swapAmount,
    swapSlippage,
    network,
    publicKey: account?.publicKey,
    amountError,
  });

  const {
    isProcessing,
    executeSwap,
    prepareSwapTransaction,
    handleProcessingScreenClose,
    fromToken,
    toToken,
  } = useSwapTransaction({
    swapAmount,
    swapFromTokenBalance,
    swapToTokenBalance,
    pathResult,
    account,
    swapFee,
    swapTimeout,
    network,
    navigation,
    resetSwap,
  });

  // Button state logic - inline instead of separate hook
  const isButtonDisabled = swapToTokenBalance
    ? isBuilding ||
      !!amountError ||
      !!pathError ||
      Number(swapAmount) <= 0 ||
      !pathResult
    : false;

  // Initialize from token on mount
  useEffect(() => {
    if (swapFromTokenId && swapFromTokenSymbol) {
      setFromToken(swapFromTokenId, swapFromTokenSymbol);
      setSwapAmount("0");
      setToToken("", ""); // Clear to token for fresh swap
    }
  }, [
    swapFromTokenId,
    swapFromTokenSymbol,
    setFromToken,
    setSwapAmount,
    setToToken,
  ]);

  // Clear swap error when amount or path changes
  useEffect(() => {
    if (swapError) {
      setSwapError(null);
    }
  }, [swapAmount, pathResult, swapError]);

  // Create menu actions
  const menuActions = useMemo(
    () =>
      createSwapMenuActions(
        navigation,
        swapFee,
        swapTimeout,
        swapSlippage,
        SWAP_ROUTES,
      ),
    [navigation, swapFee, swapSlippage, swapTimeout],
  );

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

  // Screen-specific handlers
  const handleSelectSwapToToken = () => {
    selectTokenBottomSheetModalRef.current?.present();
  };

  const handleTokenSelect = (tokenId: string, tokenSymbol: string) => {
    setToToken(tokenId, tokenSymbol);
    selectTokenBottomSheetModalRef.current?.dismiss();
  };

  const handleAmountChange = (key: string) => {
    const newAmount = formatNumericInput(swapAmount, key, DEFAULT_DECIMALS);
    setSwapAmount(newAmount);
  };

  const handleSetMax = () => {
    if (swapFromTokenBalance && account) {
      const spendableAmount = calculateSpendableAmount(
        swapFromTokenBalance,
        account.subentryCount || 0,
        swapFee,
      );
      setSwapAmount(spendableAmount.toString());
    }
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
      setSwapError(t("swapScreen.errors.failedToPrepareTransaction"));
    }
  };

  const handleConfirmSwap = () => {
    swapReviewBottomSheetModalRef.current?.dismiss();

    // Wait for the bottom sheet to dismiss before executing the swap
    setTimeout(() => {
      executeSwap().catch((error) => {
        logger.error(
          "SwapAmountScreen",
          "Swap transaction failed:",
          error instanceof Error ? error.message : String(error),
        );
        setSwapError(t("swapScreen.errors.swapTransactionFailed"));
      });
    }, 100);
  };

  const handleMainButtonPress = () => {
    if (swapToTokenBalance) {
      handleOpenReview();
    } else {
      handleSelectSwapToToken();
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
          <View className="mb-4">
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
            isLoading={isLoadingPath || isBuilding}
          >
            {swapToTokenBalance
              ? t("common.review")
              : t("swapScreen.selectAsset")}
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
