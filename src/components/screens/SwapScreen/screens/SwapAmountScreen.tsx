/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import ContextMenuButton from "components/ContextMenuButton";
import NumericKeyboard from "components/NumericKeyboard";
import { BaseLayout } from "components/layout/BaseLayout";
import { SelectTokenBottomSheet } from "components/screens/SwapScreen/components";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_DECIMALS } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
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
  const [swapFee, setSwapFee] = useState(0);
  const [swapSlippage, setSwapSlippage] = useState(0);
  const [swapTimeout, setSwapTimeout] = useState(0);
  const [swapToTokenSymbol, setSwapToTokenSymbol] = useState("");
  const [swapToTokenId, setSwapToTokenId] = useState("");
  const [swapAmount, setSwapAmount] = useState("0");

  const [amountError, setAmountError] = useState<string | null>(null);
  const { account } = useGetActiveAccount();
  const publicKey = account?.publicKey;
  const { network } = useAuthenticationStore();
  const selectTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);

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

  // Validate swap amount against spendable balance
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
        "0.00001",
      )
    ) {
      const spendableAmount = calculateSpendableAmount(
        swapFromTokenBalance,
        account?.subentryCount || 0,
        "0.00001",
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
  ]);

  const handleSelectSwapToToken = () => {
    selectTokenBottomSheetModalRef.current?.present();
  };

  const handleTokenSelect = (tokenId: string, tokenSymbol: string) => {
    setSwapToTokenId(tokenId);
    setSwapToTokenSymbol(tokenSymbol);

    selectTokenBottomSheetModalRef.current?.dismiss();
  };

  const handleAmountChange = (key: string) => {
    const newAmount = formatNumericInput(swapAmount, key, DEFAULT_DECIMALS);
    setSwapAmount(newAmount);
  };

  const handleSetMax = () => {
    if (swapFromTokenBalance) {
      // Calculate spendable amount considering minimum balance and transaction fees
      const spendableAmount = calculateSpendableAmount(
        swapFromTokenBalance,
        account?.subentryCount || 0,
        "0.00001", // Default transaction fee for swaps
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
          // TODO: Implement fee screen
          setSwapFee(swapFee + 1);
        },
      },
      {
        title: t("swapScreen.menu.timeout", {
          timeout: swapTimeout,
        }),
        systemIcon: "clock",
        onPress: () => {
          // TODO: Implement timeout screen
          setSwapTimeout(swapTimeout + 1);
        },
      },
      {
        title: t("swapScreen.menu.slippage", {
          slippage: swapSlippage,
        }),
        systemIcon: "plusminus.circle",
        onPress: () => {
          // TODO: Implement slippage screen
          setSwapSlippage(swapSlippage + 1);
        },
      },
    ],
    [t, swapFee, swapSlippage, swapTimeout],
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
              /* TODO: Implement open review */
              if (!swapToTokenBalance) {
                handleSelectSwapToToken();
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
          />
        }
      />
    </BaseLayout>
  );
};

export default SwapAmountScreen;
