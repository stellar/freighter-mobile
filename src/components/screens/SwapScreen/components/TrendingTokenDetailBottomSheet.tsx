import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BigNumber from "bignumber.js";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
} from "components/screens/SwapScreen/helpers";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { POSITIVE_PRICE_CHANGE_THRESHOLD } from "config/constants";
import {
  FormattedSearchTokenRecord,
  NonNativeToken,
  PricedBalance,
  TokenTypeWithCustomToken,
} from "config/types";
import { useSwapStore } from "ducks/swap";
import { formatFiatAmount, formatPercentageAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface TrendingTokenDetailBottomSheetProps {
  record: FormattedSearchTokenRecord;
  priceInfo: {
    currentPrice?: BigNumber;
    percentagePriceChange24h?: BigNumber;
  };
  balanceItems: Array<PricedBalance & { id: string }>;
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

export const TrendingTokenDetailBottomSheet: React.FC<
  TrendingTokenDetailBottomSheetProps
> = ({ record, priceInfo, balanceItems, bottomSheetModalRef }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { setDestinationToken } = useSwapStore();

  const token: NonNativeToken = {
    type: record.tokenType ?? TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: record.tokenCode,
    issuer: { key: record.issuer },
  };

  const handleBuy = () => {
    const heldMatch = balanceItems.find(
      (b) => b.id === `${record.tokenCode}:${record.issuer}`,
    );
    if (heldMatch) {
      setDestinationToken(descriptorFromBalance(heldMatch));
    } else {
      setDestinationToken(descriptorFromSearchRecord(record));
    }
    bottomSheetModalRef?.current?.dismiss();
  };

  const { currentPrice, percentagePriceChange24h } = priceInfo;

  return (
    <View className="gap-[16px] p-[4px]">
      <View className="flex-row items-center gap-[12px]">
        <TokenIconWithBadge
          token={token}
          iconUrl={record.iconUrl}
          securityLevel={record.securityLevel}
        />
        <View className="flex-1">
          <Text md primary medium>
            {record.tokenCode}
          </Text>
          {record.domain ? (
            <Text sm secondary numberOfLines={1}>
              {record.domain}
            </Text>
          ) : null}
        </View>
      </View>

      {record.issuer ? (
        <View className="flex-row items-center">
          <Text sm secondary>
            {truncateAddress(record.issuer)}
          </Text>
        </View>
      ) : null}

      {record.name ? (
        <Text sm secondary>
          {record.name}
        </Text>
      ) : null}

      <View className="flex-row items-center gap-[8px]">
        {currentPrice !== undefined ? (
          <Text md primary medium>
            {formatFiatAmount(currentPrice)}
          </Text>
        ) : null}
        {percentagePriceChange24h !== undefined ? (
          <TouchableOpacity activeOpacity={1}>
            <Text
              sm
              medium
              color={
                percentagePriceChange24h.gte(POSITIVE_PRICE_CHANGE_THRESHOLD)
                  ? themeColors.status.success
                  : themeColors.text.secondary
              }
            >
              {formatPercentageAmount(percentagePriceChange24h)}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Button onPress={handleBuy} primary>
        {t("swapScreen.trendingDetail.buy", { tokenCode: record.tokenCode })}
      </Button>
    </View>
  );
};

export default TrendingTokenDetailBottomSheet;
