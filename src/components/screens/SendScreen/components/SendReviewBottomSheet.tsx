import StellarLogo from "assets/logos/stellar-logo.svg";
import { BigNumber } from "bignumber.js";
import { TokenIcon } from "components/TokenIcon";
import Avatar from "components/sds/Avatar";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { PricedBalance } from "config/types";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { isLiquidityPool } from "helpers/balances";
import { formatTokenAmount, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";

type SendReviewBottomSheetProps = {
  selectedBalance?: PricedBalance;
  tokenAmount: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  isRequiredMemoMissing?: boolean;
  isValidatingMemo?: boolean;
  onBannerPress?: () => void;
};

const SendReviewBottomSheet: React.FC<SendReviewBottomSheetProps> = ({
  selectedBalance,
  tokenAmount,
  onCancel,
  onConfirm,
  isRequiredMemoMissing,
  isValidatingMemo,
  onBannerPress,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { recipientAddress, transactionMemo, transactionFee } =
    useTransactionSettingsStore();
  const { account } = useGetActiveAccount();
  const publicKey = account?.publicKey;
  const { copyToClipboard } = useClipboard();
  const slicedAddress = truncateAddress(recipientAddress, 4, 4);
  const { transactionXDR, isBuilding, error } = useTransactionBuilderStore();

  const handleCopyXdr = () => {
    if (transactionXDR) {
      copyToClipboard(transactionXDR, {
        notificationMessage: t("common.copied"),
      });
    }
  };

  const renderXdrContent = () => {
    if (isBuilding) {
      return (
        <ActivityIndicator size="small" color={themeColors.text.secondary} />
      );
    }

    if (error) {
      return (
        <Text md medium className="text-red-600">
          {t("common.error", { errorMessage: error })}
        </Text>
      );
    }

    if (transactionXDR) {
      return truncateAddress(transactionXDR, 10, 4);
    }

    return t("common.none");
  };

  const renderMemoTitle = () => {
    if (isBuilding) {
      return (
        <ActivityIndicator size="small" color={themeColors.text.secondary} />
      );
    }

    return (
      <View className="flex-row items-center gap-[8px]">
        <Icon.File02 size={16} color={themeColors.foreground.primary} />
        <Text md medium secondary>
          {t("transactionAmountScreen.details.memo")}
        </Text>
        {isRequiredMemoMissing && (
          <Icon.AlertTriangle size={16} color={themeColors.status.error} />
        )}
      </View>
    );
  };

  const renderMemoMissingWarning = () => {
    if (!isRequiredMemoMissing) {
      return null;
    }

    return (
      <Banner
        variant="error"
        text={t("transactionAmountScreen.memoMissing")}
        onPress={onBannerPress}
        className="w-full mt-[16px]"
      />
    );
  };

  const renderConfirmButton = () => {
    if (isRequiredMemoMissing || isValidatingMemo) {
      return (
        <View className="flex-1">
          <Button
            onPress={onConfirm}
            tertiary
            xl
            disabled={isBuilding || !transactionXDR || isValidatingMemo}
          >
            {t("common.addMemo")}
          </Button>
        </View>
      );
    }
    return (
      <View className="flex-1">
        <Button
          onPress={onConfirm}
          tertiary
          xl
          disabled={isBuilding || !transactionXDR || !!error}
        >
          {t("common.confirm")}
        </Button>
      </View>
    );
  };

  return (
    <View className="flex-1">
      <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-secondary">
        <Text lg medium>
          {t("transactionReviewScreen.title")}
        </Text>
        <View className="gap-[16px]">
          {selectedBalance && !isLiquidityPool(selectedBalance) && (
            <View className="w-full flex-row items-center gap-4">
              <TokenIcon token={selectedBalance} />
              <View className="flex-1">
                <Text xl medium>
                  {formatTokenAmount(tokenAmount, selectedBalance.tokenCode)}
                </Text>
                <Text md medium secondary>
                  {selectedBalance.currentPrice
                    ? formatFiatAmount(
                        new BigNumber(tokenAmount).times(
                          selectedBalance.currentPrice,
                        ),
                      )
                    : "--"}
                </Text>
              </View>
            </View>
          )}
          <View className="w-[40px] flex items-center">
            <Icon.ChevronDownDouble
              size={16}
              color={themeColors.foreground.secondary}
            />
          </View>
          <View className="w-full flex-row items-center gap-4">
            <Avatar size="lg" publicAddress={recipientAddress} />
            <View className="flex-1">
              <Text xl medium>
                {slicedAddress}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {renderMemoMissingWarning()}
      <View
        className={`rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border ${
          isRequiredMemoMissing ? "mt-[16px]" : "mt-[24px]"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Wallet01 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.from")}
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
          {renderMemoTitle()}
          <Text md medium secondary={!transactionMemo}>
            {transactionMemo || t("common.none")}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.fee")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[4px]">
            <StellarLogo width={16} height={16} />
            <Text md medium>
              {formatTokenAmount(transactionFee, NATIVE_TOKEN_CODE)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.xdr")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCopyXdr}
            disabled={isBuilding || !transactionXDR}
            className="flex-row items-center gap-[8px]"
          >
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary={isBuilding}>
              {renderXdrContent()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View className="mt-[24px]">
        <Text sm medium secondary textAlign="center">
          {t("transactionReviewScreen.reviewMessage")}
        </Text>
      </View>
      <View className="mt-[24px] gap-[12px] flex-row">
        <View className="flex-1">
          <Button onPress={onCancel} secondary xl>
            {t("common.cancel")}
          </Button>
        </View>
        {renderConfirmButton()}
      </View>
    </View>
  );
};

export default SendReviewBottomSheet;
