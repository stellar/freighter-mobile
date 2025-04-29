import { BigNumber } from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import Avatar from "components/sds/Avatar";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { PricedBalance } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { isLiquidityPool } from "helpers/balances";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

type TransactionReviewBottomSheetProps = {
  selectedBalance: PricedBalance | undefined;
  tokenValue: string;
  address: string;
  account: ActiveAccount | null;
  publicKey: string | undefined;
  onCancel?: () => void;
  onConfirm?: () => void;
};

const TransactionReviewBottomSheet: React.FC<
  TransactionReviewBottomSheetProps
> = ({
  selectedBalance,
  tokenValue,
  address,
  account,
  publicKey,
  onCancel,
  onConfirm,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const slicedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <View className="flex-1">
      <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-secondary">
        <Text lg medium>
          {t("transactionReviewScreen.title")}
        </Text>
        <View className="gap-[16px]">
          {selectedBalance && !isLiquidityPool(selectedBalance) && (
            <View className="w-full flex-row items-center gap-4">
              <AssetIcon token={selectedBalance} />
              <View className="flex-1">
                <Text xl medium>
                  {formatAssetAmount(tokenValue, selectedBalance.tokenCode)}
                </Text>
                <Text md medium secondary>
                  {formatFiatAmount(
                    new BigNumber(tokenValue).times(
                      selectedBalance.currentPrice || 0,
                    ),
                  )}
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
            <Avatar size="lg" publicAddress={address} />
            <View className="flex-1">
              <Text xl medium>
                {slicedAddress}
              </Text>
              <Text md medium secondary>
                {t("transactionReviewScreen.previousSend")}
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
              {t("transactionValueScreen.details.from")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[8px]">
            <Text md medium>
              {account?.accountName ||
                `${publicKey?.slice(0, 6)}...${publicKey?.slice(-4)}`}
            </Text>
            <Avatar size="sm" publicAddress={publicKey ?? ""} />
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.File02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionValueScreen.details.memo")}
            </Text>
          </View>
          <Text md medium secondary>
            {t("transactionValueScreen.details.none")}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionValueScreen.details.fee")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[4px]">
            {selectedBalance && <AssetIcon token={selectedBalance} size="sm" />}
            <Text md medium>
              {formatAssetAmount("0.025", selectedBalance?.tokenCode)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionValueScreen.details.xdr")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[8px]">
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text md medium>
              {t("transactionValueScreen.details.xdrPlaceholder")}
            </Text>
          </View>
        </View>
      </View>
      <View className="mt-[24px]">
        <Text sm medium secondary textAlign="center">
          {t("transactionReviewScreen.reviewMessage")}
        </Text>
      </View>
      <View className="mt-[24px] gap-[12px] flex-row">
        <View className="flex-1">
          <Button onPress={onCancel} variant="secondary" size="xl">
            {t("transactionReviewScreen.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            onPress={onConfirm}
            variant="tertiary"
            size="xl"
            icon={
              <Icon.FaceId size={18} color={themeColors.foreground.primary} />
            }
            iconPosition={IconPosition.LEFT}
          >
            {t("transactionReviewScreen.confirm")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default TransactionReviewBottomSheet; 