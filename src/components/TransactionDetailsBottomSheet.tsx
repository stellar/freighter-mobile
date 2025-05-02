import { BigNumber } from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import Avatar from "components/sds/Avatar";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { PricedBalance } from "config/types";
import { truncateAddress } from "helpers/formatAddress";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

type TransactionDetailsBottomSheetProps = {
  selectedBalance: PricedBalance | undefined;
  tokenValue: string;
  address: string;
};

const TransactionDetailsBottomSheet: React.FC<
  TransactionDetailsBottomSheetProps
> = ({ selectedBalance, tokenValue, address }) => {
  const { themeColors } = useColors();
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
    console.log("View on stellar.expert");
  };

  return (
    <View className="gap-[24px]">
      <View className="flex-row gap-[16px]">
        {selectedBalance && <AssetIcon token={selectedBalance} size="lg" />}
        <View>
          <Text md medium primary>
            {`Sent ${selectedBalance?.tokenCode}`}
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
              {formatAssetAmount(tokenValue, selectedBalance?.tokenCode)}
            </Text>
            <Text md medium secondary>
              {selectedBalance?.currentPrice
                ? formatFiatAmount(
                    new BigNumber(tokenValue).times(
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
              First time send
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
              Status
            </Text>
          </View>
          <Text md medium style={{ color: themeColors.status.success }}>
            Success
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Divide03 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              Rate
            </Text>
          </View>
          <Text md medium>
            {`1 ${selectedBalance?.tokenCode} ≈ ${selectedBalance?.currentPrice ? (1 / Number(selectedBalance.currentPrice)).toFixed(3) : "--"} USDC`}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              Fee
            </Text>
          </View>
          <Text md medium>
            0.00001 XLM
          </Text>
        </View>
      </View>

      <Button
        variant="tertiary"
        size="lg"
        onPress={handleViewOnExplorer}
        icon={
          <Icon.LinkExternal01
            size={16}
            color={themeColors.foreground.primary}
          />
        }
        iconPosition={IconPosition.RIGHT}
      >
        View on stellar.expert
      </Button>
    </View>
  );
};

export { TransactionDetailsBottomSheet };
export default TransactionDetailsBottomSheet;
