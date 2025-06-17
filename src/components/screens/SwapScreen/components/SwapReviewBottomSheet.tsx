import StellarLogo from "assets/logos/stellar-logo.svg";
import { AssetIcon } from "components/AssetIcon";
import { useSwapReview } from "components/screens/SwapScreen/hooks";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { formatAssetAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
  
  const {
    isProcessing,
    isBuilding,
    swapAmount,
    destinationAmount,
    fromToken,
    toToken,
    fromTokenSymbol,
    toTokenSymbol,
    minimumReceived,
    conversionRate,
    swapFee,
    transactionXDR,
    account,
    fromTokenFiatAmount,
    toTokenFiatAmount,
    handleCopyXdr,
    startProcessing,
    stopProcessing,
  } = useSwapReview();

  const publicKey = account?.publicKey;

  const handleConfirmSwap = () => {
    startProcessing();
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleProcessingClose = () => {
    stopProcessing();
    
    if (onCancel) {
      onCancel();
    }
  };

  if (isProcessing) {
    return (
      <SwapProcessingScreen
        onClose={handleProcessingClose}
        fromAmount={swapAmount}
        fromToken={fromToken}
        toAmount={destinationAmount}
        toToken={toToken}
      />
    );
  }

  return (
    <View className="flex-1">
      {/* Main swap section */}
      <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-tertiary">
        <Text lg medium>
          {t("swapScreen.review.title")}
        </Text>

        <View className="gap-[16px]">
          {/* From token */}
          <View className="w-full flex-row items-center gap-4">
            <AssetIcon token={fromToken} />
            <View className="flex-1">
              <Text xl medium>
                {formatAssetAmount(swapAmount, fromTokenSymbol)}
              </Text>
              <Text md medium secondary>
                {fromTokenFiatAmount || "--"}
              </Text>
            </View>
          </View>

          {/* Arrow down icon */}
          <View className="w-[40px] flex items-center">
            <Icon.ChevronDownDouble
              size={16}
              color={themeColors.foreground.secondary}
            />
          </View>

          {/* To token */}
          <View className="w-full flex-row items-center gap-4">
            <AssetIcon token={toToken} />
            <View className="flex-1">
              <Text xl medium>
                {formatAssetAmount(destinationAmount, toTokenSymbol)}
              </Text>
              <Text md medium secondary>
                {toTokenFiatAmount || "--"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Transaction details section */}
      <View className="mt-[24px] rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border">
        {/* Wallet */}
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

        {/* Minimum received */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.BarChart05 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.minimum")}
            </Text>
          </View>
          <Text md medium>
            {formatAssetAmount(minimumReceived, toTokenSymbol)}
          </Text>
        </View>

        {/* Rate */}
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

        {/* Fee */}
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

        {/* XDR */}
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

      {/* Warning message */}
      <View className="mt-[24px]">
        <Text sm medium secondary textAlign="center">
          {t("swapScreen.review.warning", {
            defaultValue:
              "Make sure to review the transaction above, once you confirm it's irreversible",
          })}
        </Text>
      </View>

      {/* Action buttons */}
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
