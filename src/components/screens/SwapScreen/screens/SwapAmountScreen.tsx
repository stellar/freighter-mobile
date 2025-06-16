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
import { useSwapSettingsStore } from "ducks/swapSettings";
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
  const [swapToTokenSymbol, setSwapToTokenSymbol] = useState("");
  const [swapToTokenId, setSwapToTokenId] = useState("");
  const [swapAmount, setSwapAmount] = useState("0");
  const [isProcessing, setIsProcessing] = useState(false);

  const [amountError, setAmountError] = useState<string | null>(null);
  const { account } = useGetActiveAccount();
  const publicKey = account?.publicKey;
  const { network } = useAuthenticationStore();
  const selectTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { balanceItems } = useBalancesList({
    publicKey: publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const swapFromTokenBalance = balanceItems.find(
    (item) => item.id === swapFromTokenId,
  );

  const swapToTokenBalance = balanceItems.find(
    (item) => item.id === swapToTokenId,
  );

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
        `Insufficient balance. Maximum spendable: ${spendableAmount.toFixed()} ${swapFromTokenSymbol}`,
      );
      console.log("error? ", amountError);
    } else {
      setAmountError(null);
    }
  }, [
    swapAmount,
    swapFromTokenBalance,
    account?.subentryCount,
    swapFromTokenSymbol,
    amountError,
    swapFee,
  ]);

  const handleSelectSwapToToken = () => {
    selectTokenBottomSheetModalRef.current?.present();
  };

  const handleTokenSelect = (tokenId: string, tokenSymbol: string) => {
    setSwapToTokenId(tokenId);
    setSwapToTokenSymbol(tokenSymbol);

    selectTokenBottomSheetModalRef.current?.dismiss();
  };

  const handleOpenReview = () => {
    swapReviewBottomSheetModalRef.current?.present();
  };

  const handleConfirmSwap = () => {
    swapReviewBottomSheetModalRef.current?.dismiss();

    // Wait for the bottom sheet to dismiss before showing the processing screen
    setTimeout(() => {
      setIsProcessing(true);
    }, 100);
  };

  const handleProcessingScreenClose = () => {
    setIsProcessing(false);

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
        toAmount="50.01" // Mock received amount - in real implementation this would come from swap calculation
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
              {swapFromTokenSymbol}
            </Text>
          </View>
        </View>

        {/* TODO: create a notification/toast session for errors/warnings */}

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
                  customTextContent={`${t("swapScreen.receive")} ${swapToTokenSymbol}`}
                  isSingleRow
                  rightContent={
                    // TODO: state that handles the conversion from token to swap token total
                    <Text sm secondary>
                      --
                    </Text>
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
