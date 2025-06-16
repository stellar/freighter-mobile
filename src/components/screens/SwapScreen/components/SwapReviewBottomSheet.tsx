import StellarLogo from "assets/logos/stellar-logo.svg";
import { AssetIcon } from "components/AssetIcon";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import {
  AssetToken,
  AssetTypeWithCustomToken,
  NativeToken,
} from "config/types";
import { formatAssetAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { TouchableOpacity, View } from "react-native";

// Mock data types (will be replaced with real data later)
type MockSwapData = {
  fromAmount: string;
  fromTokenCode: string;
  fromTokenId: string;
  fromFiatValue: string;
  toAmount: string;
  toTokenCode: string;
  toTokenId: string;
  toFiatValue: string;
  minimumReceived: string;
  conversionRate: string;
  swapFee: string;
  transactionXDR?: string;
};

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
  const publicKey = account?.publicKey;
  const { copyToClipboard } = useClipboard();

  // Mock data for now - will be replaced with real data from store
  const mockSwapData: MockSwapData = {
    fromAmount: "166.66666667",
    fromTokenCode: "XLM",
    fromTokenId: "native",
    fromFiatValue: "$50.00",
    toAmount: "50.01",
    toTokenCode: "USDC",
    toTokenId: "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    toFiatValue: "$50.01",
    minimumReceived: "49.95",
    conversionRate: "1 XLM ≈ 0.301 USDC",
    swapFee: "0.0051234",
    transactionXDR: "AAAAAggAAAAA1234567890ABCDEF",
  };

  const handleCopyXdr = () => {
    if (mockSwapData.transactionXDR) {
      copyToClipboard(mockSwapData.transactionXDR, {
        notificationMessage: t("common.copied"),
      });
    }
  };

  // Mock token data for AssetIcon (will be replaced with real balance data)
  const fromTokenMock: AssetToken | NativeToken =
    mockSwapData.fromTokenCode === "XLM"
      ? {
          type: AssetTypeWithCustomToken.NATIVE,
          code: "XLM",
        }
      : {
          code: mockSwapData.fromTokenCode,
          issuer: {
            key: "mock-issuer",
          },
          type: AssetTypeWithCustomToken.CREDIT_ALPHANUM4,
        };

  const toTokenMock: AssetToken | NativeToken =
    mockSwapData.toTokenCode === "XLM"
      ? {
          type: AssetTypeWithCustomToken.NATIVE,
          code: "XLM",
        }
      : {
          code: mockSwapData.toTokenCode,
          issuer: {
            key: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          },
          type: AssetTypeWithCustomToken.CREDIT_ALPHANUM4,
        };

  return (
    <View className="flex-1">
      {/* Main swap section */}
      <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-tertiary">
        <Text lg medium>
          {t("swapScreen.review.title", { defaultValue: "You are swapping" })}
        </Text>

        <View className="gap-[16px]">
          {/* From token */}
          <View className="w-full flex-row items-center gap-4">
            <AssetIcon token={fromTokenMock} />
            <View className="flex-1">
              <Text xl medium>
                {formatAssetAmount(
                  mockSwapData.fromAmount,
                  mockSwapData.fromTokenCode,
                )}
              </Text>
              <Text md medium secondary>
                {mockSwapData.fromFiatValue}
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
            <AssetIcon token={toTokenMock} />
            <View className="flex-1">
              <Text xl medium>
                {formatAssetAmount(
                  mockSwapData.toAmount,
                  mockSwapData.toTokenCode,
                )}
              </Text>
              <Text md medium secondary>
                {mockSwapData.toFiatValue}
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
              {t("swapScreen.review.wallet", { defaultValue: "Wallet" })}
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
              {t("swapScreen.review.minimum", { defaultValue: "Minimum" })}
            </Text>
          </View>
          <Text md medium>
            {formatAssetAmount(
              mockSwapData.minimumReceived,
              mockSwapData.toTokenCode,
            )}
          </Text>
        </View>

        {/* Rate */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.InfoCircle size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.rate", { defaultValue: "Rate" })}
            </Text>
          </View>
          <Text md medium>
            {mockSwapData.conversionRate}
          </Text>
        </View>

        {/* Fee */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.fee", { defaultValue: "Fee" })}
            </Text>
          </View>
          <View className="flex-row items-center gap-[4px]">
            <StellarLogo width={16} height={16} />
            <Text md medium>
              {formatAssetAmount(mockSwapData.swapFee, NATIVE_TOKEN_CODE)}
            </Text>
          </View>
        </View>

        {/* XDR */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.xdr", { defaultValue: "XDR" })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCopyXdr}
            disabled={!mockSwapData.transactionXDR}
            className="flex-row items-center gap-[8px]"
          >
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text md medium>
              {mockSwapData.transactionXDR
                ? truncateAddress(mockSwapData.transactionXDR, 10, 4)
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
            onPress={onConfirm}
            tertiary
            xl
            disabled={!mockSwapData.transactionXDR}
          >
            {t("common.confirm")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default SwapReviewBottomSheet;
