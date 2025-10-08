/* eslint-disable react/no-unstable-nested-components */
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import { Display, Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { THEME } from "config/theme";
import { useBalancesStore } from "ducks/balances";
import {
  formatTokenForDisplay,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import { isContractId } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

interface TokenBalanceHeaderProps {
  tokenId: string;
  tokenSymbol: string;
  actualTokenSymbol?: string;
  tokenName?: string;
}

interface TokenDisplayInfo {
  symbol: string;
  name: string;
}

const TokenBalanceHeader: React.FC<TokenBalanceHeaderProps> = ({
  tokenId,
  tokenSymbol,
  actualTokenSymbol,
  tokenName,
}) => {
  const { pricedBalances } = useBalancesStore();
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const tokenBalance = pricedBalances[tokenId];
  const isSorobanToken = isContractId(tokenId);

  const getTokenDisplayInfo = (): TokenDisplayInfo => {
    if (tokenId === "native") {
      return {
        symbol: NATIVE_TOKEN_CODE,
        name: tokenBalance.displayName || tokenSymbol,
      };
    }

    if (isSorobanToken) {
      if (actualTokenSymbol && tokenName) {
        const displaySymbol =
          actualTokenSymbol === "native"
            ? NATIVE_TOKEN_CODE
            : actualTokenSymbol;
        return { symbol: displaySymbol, name: tokenName };
      }

      const shortAddress = truncateAddress(tokenId);
      return {
        symbol: shortAddress,
        name: t("tokenDetailsScreen.sorobanToken"),
      };
    }

    return {
      symbol: tokenSymbol,
      name: tokenBalance.displayName || tokenSymbol,
    };
  };

  const { name } = getTokenDisplayInfo();
  const hasPrice = tokenBalance.currentPrice && tokenBalance.fiatTotal;

  const renderPriceInfo = () => {
    const percentageChange = tokenBalance.percentagePriceChange24h;
    const hasPercentageChange =
      percentageChange !== undefined && percentageChange !== null;

    let changeColor = themeColors.foreground.secondary;

    if (hasPercentageChange) {
      if (percentageChange.isGreaterThan(0)) {
        changeColor = themeColors.status.success;
      } else {
        changeColor = themeColors.text.secondary;
      }
    }

    return (
      <View className="gap-1">
        <Display xs medium>
          {formatFiatAmount(tokenBalance.currentPrice ?? "0")}
        </Display>
        {hasPercentageChange && (
          <View className="flex-row items-center gap-1">
            <Text md medium color={changeColor}>
              {formatPercentageAmount(percentageChange)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderBalanceInfo = () => (
    <Display xs medium>
      {formatTokenForDisplay(tokenBalance.total, tokenBalance.tokenCode)}
    </Display>
  );

  const renderBalanceDetails = () => {
    const baseRows = [
      {
        titleComponent: (
          <Text md secondary color={THEME.colors.text.secondary}>
            {t("tokenDetailsScreen.balance")}
          </Text>
        ),
        trailingContent: (
          <Text md secondary color={THEME.colors.text.primary}>
            {formatTokenForDisplay(tokenBalance.total, tokenBalance.tokenCode)}
          </Text>
        ),
      },
    ];

    const priceRow = hasPrice
      ? {
          titleComponent: (
            <Text md secondary color={THEME.colors.text.secondary}>
              {t("tokenDetailsScreen.value")}
            </Text>
          ),
          trailingContent: (
            <Text md secondary color={THEME.colors.text.primary}>
              {formatFiatAmount(tokenBalance.fiatTotal ?? "0")}
            </Text>
          ),
        }
      : null;

    const rows = priceRow ? [...baseRows, priceRow] : baseRows;

    return <List variant="secondary" items={rows} />;
  };

  return (
    <View className="gap-8">
      <View className="gap-6">
        <TokenIcon token={tokenBalance} />
        <View className="gap-2">
          <Text md medium secondary>
            {name}
          </Text>
          {hasPrice ? renderPriceInfo() : renderBalanceInfo()}
        </View>
      </View>
      {renderBalanceDetails()}
    </View>
  );
};

export default TokenBalanceHeader;
