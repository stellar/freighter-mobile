/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import ContextMenuButton from "components/ContextMenuButton";
import NumericKeyboard from "components/NumericKeyboard";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  SelectTokenBottomSheet,
  SwapReviewBottomSheet,
} from "components/screens/SwapScreen/components";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_DECIMALS } from "config/constants";
import {
  SWAP_ROUTES,
  SwapStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import { NativeToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { calculateSpendableAmount, isAmountSpendable } from "helpers/balances";
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
  const { swapFee, swapTimeout, swapSlippage } = useSwapSettingsStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const [amountError, setAmountError] = useState<string | null>(null);
  const { account } = useGetActiveAccount();
  const publicKey = account?.publicKey;
  const { network } = useAuthenticationStore();
  const selectTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);

  // Swap store for managing swap state
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
    findSwapPath,
    clearPath,
    resetSwap,
  } = useSwapStore();

  // Transaction builder for building swap transactions
  const {
    buildSwapTransaction,
    signTransaction,
    submitTransaction,
    resetTransaction,
    isBuilding,
  } = useTransactionBuilderStore();

  const { balanceItems } = useBalancesList({
    publicKey: publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const swapFromTokenBalance = balanceItems.find(
    (item) => item.id === fromTokenId,
  );

  const swapToTokenBalance = balanceItems.find(
    (item) => item.id === toTokenId,
  );

  // Initialize from token on mount
  useEffect(() => {
    if (swapFromTokenId && swapFromTokenSymbol) {
      setFromToken(swapFromTokenId, swapFromTokenSymbol);
      setSwapAmount("0"); // Reset amount when token changes
    }
  }, [swapFromTokenId, swapFromTokenSymbol, setFromToken, setSwapAmount]);

  // Validate amount and check spendability
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
        `Insufficient balance. Maximum spendable: ${spendableAmount.toFixed()} ${fromTokenSymbol}`,
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
  ]);

  // Find swap path when amount and tokens change
  useEffect(() => {
    if (
      swapFromTokenBalance &&
      swapToTokenBalance &&
      swapAmount &&
      Number(swapAmount) > 0 &&
      !amountError &&
      publicKey
    ) {
      findSwapPath({
        fromBalance: swapFromTokenBalance,
        toBalance: swapToTokenBalance,
        amount: swapAmount,
        slippage: swapSlippage,
        network,
        publicKey,
      });
    } else {
      clearPath();
    }
  }, [
    swapFromTokenBalance,
    swapToTokenBalance,
    swapAmount,
    swapSlippage,
    network,
    publicKey,
    amountError,
    findSwapPath,
    clearPath,
  ]);

  const handleSelectSwapToToken = () => {
    selectTokenBottomSheetModalRef.current?.present();
  };

  const handleTokenSelect = (tokenId: string, tokenSymbol: string) => {
    setToToken(tokenId, tokenSymbol);
    selectTokenBottomSheetModalRef.current?.dismiss();
  };

  const handleOpenReview = () => {
    swapReviewBottomSheetModalRef.current?.present();
  };

  const handleConfirmSwap = async () => {
    swapReviewBottomSheetModalRef.current?.dismiss();

    if (!swapFromTokenBalance || !swapToTokenBalance || !pathResult || !publicKey || !account) {
      return;
    }

    // Wait for the bottom sheet to dismiss before showing the processing screen
    setTimeout(() => {
      setIsProcessing(true);
    }, 100);

    try {
      // Build the swap transaction
      await buildSwapTransaction({
        tokenAmount: swapAmount,
        fromBalance: swapFromTokenBalance,
        toBalance: swapToTokenBalance,
        path: pathResult.path,
        destinationAmount: pathResult.destinationAmount,
        destinationAmountMin: pathResult.destinationAmountMin,
        transactionFee: swapFee,
        transactionTimeout: swapTimeout,
        network,
        senderAddress: publicKey,
      });

      // Sign the transaction
      signTransaction({
        secretKey: account.privateKey,
        network,
      });

      // Submit the transaction
      await submitTransaction({ network });
    } catch (error) {
      console.error("Swap failed:", error);
    }
  };

  const handleProcessingScreenClose = () => {
    setIsProcessing(false);
    resetTransaction();
    resetSwap();

    navigation.reset({
      index: 0,
      // @ts-expect-error: This is a valid route.
      routes: [{ name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK }],
    });
  };

  const handleAmountChange = (key: string) => {
    const newAmount = formatNumericInput(swapAmount, key, DEFAULT_DECIMALS);
    setSwapAmount(newAmount);
  };

  const handleSetMax = () => {
    if (swapFromTokenBalance) {
      const spendableAmount = calculateSpendableAmount(
        swapFromTokenBalance,
        account?.subentryCount || 0,
        swapFee,
      );

      setSwapAmount(spendableAmount.toString());
    }
  };

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
    [t, navigation, swapFee, swapSlippage, swapTimeout],
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

  if (isProcessing) {
    // Extract token from balance or create fallback
    let fromToken;
    if (swapFromTokenBalance && "token" in swapFromTokenBalance) {
      fromToken = swapFromTokenBalance.token;
    } else {
      const fallbackToken: NativeToken = { type: "native", code: "XLM" };
      fromToken = fallbackToken;
    }

    let toToken;
    if (swapToTokenBalance && "token" in swapToTokenBalance) {
      toToken = swapToTokenBalance.token;
    } else {
      const fallbackToken: NativeToken = { type: "native", code: "XLM" };
      toToken = fallbackToken;
    }

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

  // Show loading state while finding path
  const isSwapReady = pathResult && !isLoadingPath && !pathError;
  const hasSwapPair = swapFromTokenBalance && swapToTokenBalance;

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
          <View className="mx-6 mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <Text sm medium className="text-red-600">
              {amountError || pathError}
            </Text>
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
                      {isLoadingPath ? (
                        <Text sm secondary>
                          {t("common.loading")}...
                        </Text>
                      ) : isSwapReady ? (
                        <Text sm medium>
                          {destinationAmount} {toTokenSymbol}
                        </Text>
                      ) : (
                        <Text sm secondary>
                          --
                        </Text>
                      )}
                      {pathResult && (
                        <Text xs secondary>
                          Rate: {pathResult.conversionRate}
                        </Text>
                      )}
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
            onPress={() => {
              if (!swapToTokenBalance) {
                handleSelectSwapToToken();
              } else {
                handleOpenReview();
              }
            }}
            disabled={
              isBuilding ||
              isLoadingPath ||
              !!amountError ||
              !!pathError ||
              Number(swapAmount) <= 0 ||
              !hasSwapPair ||
              !isSwapReady
            }
          >
            {!swapToTokenBalance
              ? t("swapScreen.selectAsset")
              : isLoadingPath
                ? t("common.loading")
                : isSwapReady
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
