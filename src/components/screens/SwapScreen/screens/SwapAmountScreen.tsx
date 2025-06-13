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
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
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

  const handleSelectSwapToToken = () => {
    selectTokenBottomSheetModalRef.current?.present();
  };

  const handleTokenSelect = (tokenId: string, tokenSymbol: string) => {
    setSwapToTokenId(tokenId);
    setSwapToTokenSymbol(tokenSymbol);

    selectTokenBottomSheetModalRef.current?.dismiss();
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
            <Display md medium>
              0
            </Display>
            <Text md medium secondary>
              {swapFromTokenSymbol}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text sm secondary>
              -- {swapToTokenSymbol}
            </Text>
            <Icon.RefreshCcw03 size={12} color={themeColors.text.secondary} />
          </View>
        </View>
        {/* TODO: create a notification session for errors/warnings */}
        <View className="gap-3 mt-[16px]">
          <View className="rounded-[12px] py-[12px] px-[16px] bg-background-tertiary">
            {swapFromTokenBalance && (
              <BalanceRow
                balance={swapFromTokenBalance}
                rightContent={
                  <Button
                    secondary
                    lg
                    onPress={() => {
                      /* TODO: Implement set max */
                    }}
                  >
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
                <BalanceRow balance={swapToTokenBalance} isSingleRow />
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
          <NumericKeyboard
            onPress={() => {
              /* TODO: Implement amount change */
            }}
          />
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
