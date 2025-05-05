import StellarLogo from "assets/logos/stellar-logo.svg";
import { BigNumber } from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import Avatar from "components/sds/Avatar";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { TRANSACTION_RECOMMENDED_FEE } from "config/constants";
import { PricedBalance } from "config/types";
import { truncateAddress } from "helpers/formatAddress";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

type TransactionDetailsBottomSheetProps = {
  selectedBalance: PricedBalance | undefined;
  tokenAmount: string;
  address: string;
};

const FEE_CURRENCY = "XLM";
const TransactionDetailsBottomSheet: React.FC<
  TransactionDetailsBottomSheetProps
> = ({ selectedBalance, tokenAmount, address }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const slicedAddress = truncateAddress(address, 4, 4);

  // TODO: Get current date and time for the transaction
  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = now
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();

  const dateTimeDisplay = `${formattedDate} · ${formattedTime}`;

  const handleViewOnExplorer = () => {
    // TODO: In the future, this could open a web link to stellar.expert with the transaction details
    console.log(t("transactionDetailsBottomSheet.viewOnExpert"));
  };

  return (
    <View className="gap-[24px]">
      <View className="flex-row gap-[16px]">
        {selectedBalance && <AssetIcon token={selectedBalance} size="lg" />}
        <View>
          <Text md medium primary>
            {t("transactionDetailsBottomSheet.sent", {
              tokenCode: selectedBalance?.tokenCode,
            })}
          </Text>
          <View className="flex-row items-center gap-[4px]">
            <Icon.ArrowCircleUp size={16} color={themeColors.text.secondary} />
            <Text sm medium secondary>
              {dateTimeDisplay}
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-background-secondary rounded-[16px] p-[24px] gap-[12px]">
        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {formatAssetAmount(tokenAmount, selectedBalance?.tokenCode)}
            </Text>
            <Text md medium secondary>
              {selectedBalance?.currentPrice
                ? formatFiatAmount(
                    new BigNumber(tokenAmount).times(
                      selectedBalance.currentPrice,
                    ),
                  )
                : "--"}
            </Text>
          </View>
          {selectedBalance && <AssetIcon token={selectedBalance} size="lg" />}
        </View>

        <View>
          <View className="w-[32px] h-[32px] rounded-full bg-tertiary justify-center items-center border border-gray-6">
            <Icon.ChevronDownDouble
              size={20}
              color={themeColors.foreground.primary}
            />
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {slicedAddress}
            </Text>
            <Text md medium secondary>
              {t("transactionDetailsBottomSheet.firstTimeSend")}
            </Text>
          </View>
          <Avatar size="lg" publicAddress={address} />
        </View>
      </View>

      <View className="rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.ClockCheck size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionDetailsBottomSheet.status")}
            </Text>
          </View>
          <Text md medium color={themeColors.status.success}>
            {t("transactionDetailsBottomSheet.statusSuccess")}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.File02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.memo")}
            </Text>
          </View>
          <Text md medium secondary>
            {t("common.none")}
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
              {/* TODO: get the fee amount from the transaction */}
              {formatAssetAmount(TRANSACTION_RECOMMENDED_FEE, FEE_CURRENCY)}
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
          <View className="flex-row items-center gap-[8px]">
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text md medium>
              {t("transactionAmountScreen.details.xdrPlaceholder")}
            </Text>
          </View>
        </View>
      </View>

      <Button
        tertiary
        lg
        onPress={handleViewOnExplorer}
        icon={
          <Icon.LinkExternal01
            size={16}
            color={themeColors.foreground.primary}
          />
        }
        iconPosition={IconPosition.RIGHT}
      >
        {t("transactionDetailsBottomSheet.viewOnExpert")}
      </Button>
    </View>
  );
};

export { TransactionDetailsBottomSheet };
export default TransactionDetailsBottomSheet;
