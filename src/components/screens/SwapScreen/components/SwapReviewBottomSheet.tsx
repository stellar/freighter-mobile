import StellarLogo from "assets/logos/stellar-logo.svg";
import { AssetIcon } from "components/AssetIcon";
import {
  formatConversionRate,
  getTokenFromBalance,
  calculateTokenFiatAmount,
  calculateConversionRate,
  calculateMinimumReceived,
} from "components/screens/SwapScreen/helpers";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { TouchableOpacity, View } from "react-native";

type SwapReviewBottomSheetProps = {
  onCancel?: () => void;
  onConfirm?: () => void;
};

const SwapReviewBottomSheet: React.FC<SwapReviewBottomSheetProps> = ({
  onCancel,
  onConfirm,
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

  const displayConversionRate =
    pathResult?.conversionRate ||
    calculateConversionRate(sourceAmount, destinationAmount, undefined);
  const conversionRate = formatConversionRate(
    displayConversionRate,
    sourceTokenSymbol,
    destinationTokenSymbol,
  );

  const displayMinimumReceived =
    pathResult?.destinationAmountMin ||
    calculateMinimumReceived(
      destinationAmount,
      swapSlippage.toString(),
      undefined,
    );

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
    shouldPoll: false,
  });

  const sourceBalance = balanceItems.find((item) => item.id === sourceTokenId);
  const destinationBalance = balanceItems.find(
    (item) => item.id === destinationTokenId,
  );

  const sourceToken = getTokenFromBalance(sourceBalance);
  const destinationToken = getTokenFromBalance(destinationBalance);

  const sourceTokenFiatAmountValue = calculateTokenFiatAmount(
    sourceToken,
    sourceAmount,
    balanceItems,
  );
  const sourceTokenFiatAmount =
    sourceTokenFiatAmountValue !== "--"
      ? formatFiatAmount(sourceTokenFiatAmountValue)
      : "--";

  const destinationTokenFiatAmountValue = calculateTokenFiatAmount(
    destinationToken,
    destinationAmount,
    balanceItems,
  );
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
            <AssetIcon token={sourceToken} />
            <View className="flex-1">
              <Text xl medium>
                {formatAssetAmount(sourceAmount, sourceTokenSymbol)}
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
            <AssetIcon token={destinationToken} />
            <View className="flex-1">
              <Text xl medium>
                {formatAssetAmount(destinationAmount, destinationTokenSymbol)}
              </Text>
              <Text md medium secondary>
                {destinationTokenFiatAmount}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mt-[24px] rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Wallet01 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.wallet")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[8px]">
            <Text md medium>
              {account?.accountName || truncateAddress(publicKey ?? "", 4, 4)}
            </Text>
            <Avatar size="sm" publicAddress={publicKey ?? ""} />
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.BarChart05 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.minimum")}
            </Text>
          </View>
          <Text md medium>
            {formatAssetAmount(displayMinimumReceived, destinationTokenSymbol)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.InfoCircle size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.rate")}
            </Text>
          </View>
          <Text md medium>
            {conversionRate}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.fee")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[4px]">
            <StellarLogo width={16} height={16} />
            <Text md medium>
              {formatAssetAmount(swapFee, NATIVE_TOKEN_CODE)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.xdr")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCopyXdr}
            disabled={!transactionXDR}
            className="flex-row items-center gap-[8px]"
          >
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text md medium>
              {transactionXDR
                ? truncateAddress(transactionXDR, 10, 4)
                : t("common.none")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mt-[24px]">
        <Text sm medium secondary textAlign="center">
          {t("swapScreen.review.warning")}
        </Text>
      </View>

      <View className="mt-[24px] gap-[12px] flex-row">
        <View className="flex-1">
          <Button onPress={onCancel} secondary xl>
            {t("common.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            onPress={handleConfirmSwap}
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
