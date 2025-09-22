import StellarLogo from "assets/logos/stellar-logo.svg";
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import {
  formatConversionRate,
  getTokenFromBalance,
  calculateTokenFiatAmount,
  calculateMinimumReceived,
} from "components/screens/SwapScreen/helpers";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { calculateSwapRate } from "helpers/balances";
import { pxValue } from "helpers/dimensions";
import { formatTokenAmount, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useMemo, useState, useEffect } from "react";
import { TouchableOpacity, View } from "react-native";

type SwapReviewBottomSheetProps = {
  onCancel?: () => void;
  onConfirm?: () => void;
  onSettingsPress?: () => void;
};

const SwapReviewBottomSheet: React.FC<SwapReviewBottomSheetProps> = ({
  onCancel,
  onConfirm,
  onSettingsPress,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { copyToClipboard } = useClipboard();

  const {
    sourceAmount,
    destinationAmount,
    pathResult,
    sourceTokenSymbol,
    destinationTokenSymbol,
  } = useSwapStore();

  const { swapFee, swapSlippage } = useSwapSettingsStore();
  const { transactionXDR, isBuilding } = useTransactionBuilderStore();

  const [stableConversionRate, setStableConversionRate] = useState<string>("");
  const [stableMinimumReceived, setStableMinimumReceived] =
    useState<string>("");

  // Use sourceAmount as-is since it's already in the correct format for display

  const currentConversionRate =
    pathResult?.conversionRate ||
    calculateSwapRate(
      Number(pathResult?.sourceAmount),
      Number(pathResult?.destinationAmount),
    );

  const currentMinimumReceived =
    pathResult?.destinationAmountMin ||
    calculateMinimumReceived({
      destinationAmount: pathResult?.destinationAmount || "0",
      allowedSlippage: swapSlippage.toString(),
      minimumReceived: undefined,
    });

  useEffect(() => {
    if (
      currentConversionRate &&
      !Number.isNaN(Number(currentConversionRate)) &&
      Number(currentConversionRate) > 0
    ) {
      const formattedRate = formatConversionRate({
        rate: currentConversionRate,
        sourceSymbol: sourceTokenSymbol,
        destinationSymbol: destinationTokenSymbol,
      });

      setStableConversionRate(formattedRate);
    }
  }, [currentConversionRate, sourceTokenSymbol, destinationTokenSymbol]);

  useEffect(() => {
    if (
      currentMinimumReceived &&
      !Number.isNaN(Number(currentMinimumReceived)) &&
      Number(currentMinimumReceived) > 0
    ) {
      setStableMinimumReceived(currentMinimumReceived);
    }
  }, [currentMinimumReceived]);

  const handleCopyXdr = () => {
    if (transactionXDR) {
      copyToClipboard(transactionXDR, {
        notificationMessage: t("common.copied"),
      });
    }
  };

  const { sourceTokenId, destinationTokenId } = useSwapStore();
  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });

  const sourceBalance = useMemo(
    () => balanceItems.find((item) => item.id === sourceTokenId),
    [balanceItems, sourceTokenId],
  );

  const destinationBalance = useMemo(
    () => balanceItems.find((item) => item.id === destinationTokenId),
    [balanceItems, destinationTokenId],
  );

  const sourceToken = getTokenFromBalance(sourceBalance);
  const destinationToken = getTokenFromBalance(destinationBalance);

  const sourceTokenFiatAmountValue = calculateTokenFiatAmount({
    token: sourceToken,
    amount: pathResult?.sourceAmount || sourceAmount,
    balanceItems,
  });

  const sourceTokenFiatAmount =
    sourceTokenFiatAmountValue !== "--"
      ? formatFiatAmount(sourceTokenFiatAmountValue)
      : "--";

  const destinationTokenFiatAmountValue = calculateTokenFiatAmount({
    token: destinationToken,
    amount: pathResult?.destinationAmount || destinationAmount,
    balanceItems,
  });
  const destinationTokenFiatAmount =
    destinationTokenFiatAmountValue !== "--"
      ? formatFiatAmount(destinationTokenFiatAmountValue)
      : "--";

  const publicKey = account?.publicKey;

  const handleConfirmSwap = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  return (
    <View className="flex-1">
      <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-tertiary">
        <Text lg medium>
          {t("swapScreen.review.title")}
        </Text>

        <View className="gap-[16px]">
          <View className="w-full flex-row items-center gap-4">
            <TokenIcon token={sourceToken} />
            <View className="flex-1">
              <Text xl medium>
                {formatTokenAmount(sourceAmount, sourceTokenSymbol)}
              </Text>
              <Text md medium secondary>
                {sourceTokenFiatAmount}
              </Text>
            </View>
          </View>

          <View className="w-[40px] flex items-center">
            <Icon.ChevronDownDouble
              size={16}
              color={themeColors.foreground.secondary}
            />
          </View>

          <View className="w-full flex-row items-center gap-4">
            <TokenIcon token={destinationToken} />
            <View className="flex-1">
              <Text xl medium>
                {formatTokenAmount(destinationAmount, destinationTokenSymbol)}
              </Text>
              <Text md medium secondary>
                {destinationTokenFiatAmount}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <List
        variant="secondary"
        className="mt-[24px]"
        items={[
          {
            icon: <Icon.Wallet01 size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.wallet")}
              </Text>
            ),
            trailingContent: (
              <View className="flex-row items-center gap-[8px]">
                <Text md medium>
                  {account?.accountName ||
                    truncateAddress(publicKey ?? "", 4, 4)}
                </Text>
                <Avatar
                  size="sm"
                  publicAddress={publicKey ?? ""}
                  hasDarkBackground
                />
              </View>
            ),
          },
          {
            icon: <Icon.BarChart05 size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.minimum")}
              </Text>
            ),
            trailingContent: (
              <Text md medium>
                {stableMinimumReceived
                  ? formatTokenAmount(
                      stableMinimumReceived,
                      destinationTokenSymbol,
                    )
                  : "--"}
              </Text>
            ),
          },
          {
            icon: <Icon.InfoCircle size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.rate")}
              </Text>
            ),
            trailingContent: (
              <Text md medium>
                {stableConversionRate || "--"}
              </Text>
            ),
          },
          {
            icon: <Icon.Route size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.fee")}
              </Text>
            ),
            trailingContent: (
              <View className="flex-row items-center gap-[4px]">
                <StellarLogo width={pxValue(16)} height={pxValue(16)} />
                <Text md medium>
                  {formatTokenAmount(swapFee, NATIVE_TOKEN_CODE)}
                </Text>
              </View>
            ),
          },
          {
            icon: <Icon.FileCode02 size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.xdr")}
              </Text>
            ),
            trailingContent: (
              <TouchableOpacity
                onPress={handleCopyXdr}
                disabled={!transactionXDR}
                className="flex-row items-center gap-[8px]"
              >
                <Icon.Copy01 size={16} themeColor="gray" />
                <Text md medium>
                  {transactionXDR
                    ? truncateAddress(transactionXDR, 10, 4)
                    : t("common.none")}
                </Text>
              </TouchableOpacity>
            ),
          },
        ]}
      />

      <View className="mt-[24px]">
        <Text sm medium secondary textAlign="center">
          {t("swapScreen.review.warning")}
        </Text>
      </View>

      <View className="mt-[24px] gap-[12px] flex-row">
        {onSettingsPress && (
          <TouchableOpacity
            onPress={onSettingsPress}
            className="w-[46px] h-[46px] rounded-full border border-gray-6 items-center justify-center"
          >
            <Icon.Settings04 size={24} themeColor="gray" />
          </TouchableOpacity>
        )}
        <View className="flex-1">
          <Button onPress={onCancel} secondary xl>
            {t("common.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            biometric
            onPress={() => handleConfirmSwap()}
            tertiary
            xl
            disabled={!transactionXDR || isBuilding}
          >
            {t("common.confirm")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default SwapReviewBottomSheet;
