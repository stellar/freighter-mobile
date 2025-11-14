/* eslint-disable react/no-unstable-nested-components */
import { BigNumber } from "bignumber.js";
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
import {
  isContractId,
  formatTokenForDisplay as formatSorobanTokenAmount,
} from "helpers/soroban";
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

  const isSorobanToken = isContractId(tokenId);

  // For Soroban tokens, balances are stored as SYMBOL:CONTRACTID, so we need to find by contractId
  let tokenBalance: (typeof pricedBalances)[string] | undefined;
  if (isSorobanToken) {
    // Find balance by matching contractId
    tokenBalance = Object.values(pricedBalances).find(
      (balance) => "contractId" in balance && balance.contractId === tokenId,
    );
  } else {
    // For classic tokens, use the tokenId directly
    tokenBalance = pricedBalances[tokenId];
  }

  // Early return if tokenBalance is not available
  if (!tokenBalance) {
    return null;
  }

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

  const renderBalanceInfo = () => {
    const amountToDisplay = tokenBalance.total;
    // For Soroban tokens, convert from base units to human-readable format
    if (
      "decimals" in tokenBalance &&
      typeof tokenBalance.decimals === "number" &&
      tokenBalance.decimals > 0
    ) {
      const humanReadableAmount = formatSorobanTokenAmount(
        new BigNumber(amountToDisplay),
        tokenBalance.decimals,
      );
      return (
        <Display xs medium>
          {formatTokenForDisplay(humanReadableAmount, tokenBalance.tokenCode)}
        </Display>
      );
    }
    return (
      <Display xs medium>
        {formatTokenForDisplay(amountToDisplay, tokenBalance.tokenCode)}
      </Display>
    );
  };

  const renderBalanceDetails = () => {
    const amountToDisplay = tokenBalance.total;
    // For Soroban tokens, convert from base units to human-readable format
    let balanceDisplay: string;
    if (
      "decimals" in tokenBalance &&
      typeof tokenBalance.decimals === "number" &&
      tokenBalance.decimals > 0
    ) {
      const humanReadableAmount = formatSorobanTokenAmount(
        new BigNumber(amountToDisplay),
        tokenBalance.decimals,
      );
      balanceDisplay = formatTokenForDisplay(
        humanReadableAmount,
        tokenBalance.tokenCode,
      );
    } else {
      balanceDisplay = formatTokenForDisplay(
        amountToDisplay,
        tokenBalance.tokenCode,
      );
    }

    const baseRows = [
      {
        titleComponent: (
          <Text md secondary color={THEME.colors.text.secondary}>
            {t("tokenDetailsScreen.balance")}
          </Text>
        ),
        trailingContent: (
          <Text md secondary color={THEME.colors.text.primary}>
            {balanceDisplay}
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
