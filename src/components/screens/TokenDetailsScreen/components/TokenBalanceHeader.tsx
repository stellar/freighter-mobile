/* eslint-disable react/no-unstable-nested-components */
import StellarLogo from "assets/logos/stellar-logo.svg";
import { AssetIcon } from "components/AssetIcon";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
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

interface BalanceRowProps {
  label: string;
  value: string;
  isNativeToken?: boolean;
}

const BalanceRow: React.FC<BalanceRowProps> = ({
  label,
  value,
  isNativeToken,
}) => (
  <View className="flex-row justify-between items-center">
    <Text md medium secondary>
      {label}
    </Text>
    <View className="flex-row items-center gap-1">
      {isNativeToken && <StellarLogo width={16} height={16} />}
      <Text md medium>
        {value}
      </Text>
    </View>
  </View>
);

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
    let ChangeIcon = null;

    if (hasPercentageChange) {
      if (percentageChange.isGreaterThan(0)) {
        changeColor = themeColors.status.success;
        ChangeIcon = Icon.ArrowUp;
      } else if (percentageChange.isLessThan(0)) {
        changeColor = themeColors.status.error;
        ChangeIcon = Icon.ArrowDown;
      }
    }

    return (
      <View className="gap-1">
        <Display xs medium>
          {formatFiatAmount(tokenBalance.currentPrice ?? 0)}
        </Display>
        {hasPercentageChange && (
          <View className="flex-row items-center gap-1">
            {ChangeIcon && <ChangeIcon size={16} color={changeColor} />}
            <Text md medium color={changeColor}>
              {t("tokenDetailsScreen.priceChange", {
                percentage: Math.abs(percentageChange.toNumber()).toFixed(2),
              })}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderBalanceInfo = () => (
    <Display xs medium>
      {formatAssetAmount(tokenBalance.total, tokenBalance.tokenCode)}
    </Display>
  );

  const renderBalanceDetails = () => {
    const baseRows = [
      {
        label: t("tokenDetailsScreen.balance"),
        value: formatAssetAmount(tokenBalance.total, tokenBalance.tokenCode),
        isNativeToken: tokenId === "native" || tokenId === NATIVE_TOKEN_CODE,
      },
    ];

    const priceRow = hasPrice
      ? {
          label: t("tokenDetailsScreen.value"),
          value: formatFiatAmount(tokenBalance.fiatTotal ?? 0),
          isNativeToken: false,
        }
      : null;

    const rows = priceRow ? [...baseRows, priceRow] : baseRows;

    return (
      <View className="border border-border-primary p-6 rounded-[16px] gap-3">
        {rows.map((row) => (
          <BalanceRow
            key={row.label}
            label={row.label}
            value={row.value}
            isNativeToken={row.isNativeToken}
          />
        ))}
      </View>
    );
  };

  return (
    <View className="gap-8">
      <View className="gap-6">
        <AssetIcon token={tokenBalance} />
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
