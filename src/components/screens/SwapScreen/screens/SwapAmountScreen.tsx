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

  const selectTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });

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

  const swapFromTokenBalance = balanceItems.find(
    (item) => item.id === fromTokenId,
  );
  const swapToTokenBalance = balanceItems.find((item) => item.id === toTokenId);

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

  const isButtonDisabled = swapToTokenBalance
    ? isBuilding ||
      !!amountError ||
      !!pathError ||
      Number(swapAmount) <= 0 ||
      !pathResult
    : false;

  useEffect(() => {
    if (swapFromTokenId && swapFromTokenSymbol) {
      setFromToken(swapFromTokenId, swapFromTokenSymbol);
      setSwapAmount("0");
      setToToken("", "");
    }
  }, [
    swapFromTokenId,
    swapFromTokenSymbol,
    setFromToken,
    setSwapAmount,
    setToToken,
  ]);

  useEffect(() => {
    if (swapError) {
      setSwapError(null);
    }
  }, [swapAmount, pathResult, swapError]);

  const menuActions = useMemo(
    () => [
      {
        title: t("swapScreen.menu.fee", { fee: swapFee }),
        systemIcon: "divide.circle",
        onPress: () => {
          navigation.navigate(SWAP_ROUTES.SWAP_FEE_SCREEN);
        },
      },
      {
        title: t("swapScreen.menu.timeout", {
          timeout: swapTimeout,
        }),
        systemIcon: "clock",
        onPress: () => {
          navigation.navigate(SWAP_ROUTES.SWAP_TIMEOUT_SCREEN);
        },
      },
      {
        title: t("swapScreen.menu.slippage", {
          slippage: swapSlippage,
        }),
        systemIcon: "plusminus.circle",
        onPress: () => {
          navigation.navigate(SWAP_ROUTES.SWAP_SLIPPAGE_SCREEN);
        },
      },
    ],
    [navigation, swapFee, swapSlippage, swapTimeout, t],
  );

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

        {(amountError || pathError || swapError) && (
          <View className="mb-2">
            <Notification
              variant="error"
              message={amountError || pathError || swapError || ""}
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

        <View className="w-full mt-[56px] mb-[24px]">
          <NumericKeyboard onPress={handleAmountChange} />
        </View>

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

      <BottomSheet
        modalRef={selectTokenBottomSheetModalRef}
        handleCloseModal={() =>
          selectTokenBottomSheetModalRef.current?.dismiss()
        }
        snapPoints={["80%"]}
        customContent={
          <SelectTokenBottomSheet
            onTokenSelect={handleTokenSelect}
            customTitle={t("swapScreen.swapScreenTokenListTitle")}
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
