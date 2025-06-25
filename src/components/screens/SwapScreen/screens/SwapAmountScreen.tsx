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
import { TouchableOpacity, View, Text as RNText } from "react-native";

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
    sourceTokenId,
    destinationTokenId,
    sourceTokenSymbol,
    destinationTokenSymbol,
    sourceAmount,
    destinationAmount,
    pathResult,
    isLoadingPath,
    pathError,
    setSourceToken,
    setDestinationToken,
    setSourceAmount,
  } = useSwapStore();

  const sourceBalance = useMemo(
    () => balanceItems.find((item) => item.id === sourceTokenId),
    [balanceItems, sourceTokenId],
  );

  const destinationBalance = useMemo(
    () => balanceItems.find((item) => item.id === destinationTokenId),
    [balanceItems, destinationTokenId],
  );

  const spendableAmount = useMemo(() => {
    if (!sourceBalance || !account) return null;

    return calculateSpendableAmount({
      balance: sourceBalance,
      subentryCount: account.subentryCount || 0,
      transactionFee: swapFee,
    });
  }, [sourceBalance, account, swapFee]);

  useEffect(() => {
    if (!sourceBalance || !sourceAmount || sourceAmount === "0") {
      setAmountError(null);
      return;
    }

    if (
      !isAmountSpendable({
        amount: sourceAmount,
        balance: sourceBalance,
        subentryCount: account?.subentryCount,
        transactionFee: swapFee,
      })
    ) {
      setAmountError(
        t("swapScreen.errors.insufficientBalance", {
          amount: spendableAmount?.toFixed() || "0",
          symbol: sourceTokenSymbol,
        }),
      );
    } else {
      setAmountError(null);
    }
  }, [
    sourceAmount,
    spendableAmount,
    sourceTokenSymbol,
    t,
    account?.subentryCount,
    swapFee,
    sourceBalance,
  ]);

  useSwapPathFinding({
    sourceBalance,
    destinationBalance,
    sourceAmount,
    swapSlippage,
    network,
    publicKey: account?.publicKey,
    amountError,
  });

  const {
    isProcessing,
    executeSwap,
    setupSwapTransaction,
    handleProcessingScreenClose,
    sourceToken,
    destinationToken,
  } = useSwapTransaction({
    sourceAmount,
    sourceBalance,
    destinationBalance,
    pathResult,
    account,
    swapFee,
    swapTimeout,
    network,
    navigation,
  });

  const isButtonDisabled = destinationBalance
    ? isBuilding ||
      !!amountError ||
      !!pathError ||
      Number(sourceAmount) <= 0 ||
      !pathResult
    : false;

  useEffect(() => {
    if (swapFromTokenId && swapFromTokenSymbol) {
      setSourceToken(swapFromTokenId, swapFromTokenSymbol);
      setSourceAmount("0");
      setDestinationToken("", "");
    }
  }, [
    swapFromTokenId,
    swapFromTokenSymbol,
    setSourceToken,
    setSourceAmount,
    setDestinationToken,
  ]);

  useEffect(() => {
    if (swapError) {
      setSwapError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceAmount, pathResult]);

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

  const handleSelectDestinationToken = () => {
    selectTokenBottomSheetModalRef.current?.present();
  };

  const handleDestinationTokenSelect = (
    tokenId: string,
    tokenSymbol: string,
  ) => {
    setDestinationToken(tokenId, tokenSymbol);
    selectTokenBottomSheetModalRef.current?.dismiss();
  };

  const handleAmountChange = (key: string) => {
    const newAmount = formatNumericInput(sourceAmount, key, DEFAULT_DECIMALS);
    setSourceAmount(newAmount);
  };

  const handleSetMax = () => {
    if (spendableAmount) {
      setSourceAmount(spendableAmount.toString());
    }
  };

  const handlePercentagePress = (percentage: number) => {
    if (!spendableAmount) return;

    if (percentage === 100) {
      handleSetMax();
    } else {
      const targetAmount = spendableAmount.multipliedBy(percentage / 100);
      setSourceAmount(targetAmount.toFixed(DEFAULT_DECIMALS));
    }
  };

  const handleOpenReview = async () => {
    try {
      await setupSwapTransaction();

      swapReviewBottomSheetModalRef.current?.present();
    } catch (error) {
      logger.error(
        "SwapAmountScreen",
        "Failed to setup swap transaction:",
        error instanceof Error ? error.message : String(error),
      );
      setSwapError(t("swapScreen.errors.failedToSetupTransaction"));
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
    if (destinationBalance) {
      handleOpenReview();
    } else {
      handleSelectDestinationToken();
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
        sourceAmount={sourceAmount}
        sourceToken={sourceToken}
        destinationAmount={destinationAmount || "0"}
        destinationToken={destinationToken}
      />
    );
  }

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <View className="flex-1">
        <View className="items-center py-[24px] px-6">
          <View className="flex-row items-center gap-1">
            <Display
              xl
              medium
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.6}
            >
              {sourceAmount}{" "}
              <RNText style={{ color: themeColors.text.secondary }}>
                {sourceTokenSymbol}
              </RNText>
            </Display>
          </View>
        </View>

        {(amountError || pathError || swapError) && (
          <Notification
            variant="error"
            message={amountError || pathError || swapError || ""}
          />
        )}

        <View className="gap-3 mt-[16px]">
          <View className="rounded-[12px] py-[12px] px-[16px] bg-background-tertiary">
            {sourceBalance && (
              <BalanceRow
                balance={sourceBalance}
                rightContent={
                  <Button secondary lg onPress={handleSetMax}>
                    {t("swapScreen.setMax")}
                  </Button>
                }
                isSingleRow
              />
            )}
          </View>

          <TouchableOpacity onPress={handleSelectDestinationToken}>
            <View className="rounded-[12px] py-[12px] px-[16px] bg-background-tertiary">
              {destinationBalance ? (
                <BalanceRow
                  balance={destinationBalance}
                  customTextContent={`${t("swapScreen.receive")} ${destinationTokenSymbol}`}
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

        <View className="flex-1 justify-between mt-[24px]">
          <View className="flex-row gap-[8px]">
            <View className="flex-1">
              <Button secondary lg onPress={() => handlePercentagePress(25)}>
                {t("transactionAmountScreen.percentageButtons.twentyFive")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary lg onPress={() => handlePercentagePress(50)}>
                {t("transactionAmountScreen.percentageButtons.fifty")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary lg onPress={() => handlePercentagePress(75)}>
                {t("transactionAmountScreen.percentageButtons.seventyFive")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary lg onPress={() => handlePercentagePress(100)}>
                {t("transactionAmountScreen.percentageButtons.max")}
              </Button>
            </View>
          </View>

          <View className="flex-1 justify-center">
            <NumericKeyboard onPress={handleAmountChange} />
          </View>

          <View className="mb-4">
            <Button
              tertiary
              xl
              onPress={handleMainButtonPress}
              disabled={isButtonDisabled}
              isLoading={isLoadingPath || isBuilding}
            >
              {destinationBalance
                ? t("common.review")
                : t("swapScreen.selectAsset")}
            </Button>
          </View>
        </View>
      </View>

      <BottomSheet
        modalRef={selectTokenBottomSheetModalRef}
        handleCloseModal={() =>
          selectTokenBottomSheetModalRef.current?.dismiss()
        }
        snapPoints={["80%"]}
        enablePanDownToClose={false}
        enableContentPanningGesture={false}
        enableDynamicSizing={false}
        disableAutomaticBottomPadding
        customContent={
          <SelectTokenBottomSheet
            onTokenSelect={handleDestinationTokenSelect}
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
