import BigNumber from "bignumber.js";
import { List, ListItemProps } from "components/List";
import { makeDetailRow } from "components/screens/TokenDetailsScreen/components/PriceHistory/detailRow";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { TokenIdentifier } from "config/types";
import { usePriceHistoryStore, useTokenStatsEntry } from "ducks/priceHistory";
import useAppTranslation from "hooks/useAppTranslation";
import usePriceHistoryEnabled from "hooks/usePriceHistoryEnabled";
import React, { useEffect } from "react";
import { View } from "react-native";
import { getNumberFormatSettings } from "react-native-localize";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

interface TokenStatsSectionProps {
  /** Route-param token identifier ("native" for XLM) */
  tokenId: TokenIdentifier;
  network: NETWORKS;
}

/** Grouped-integer display for supply/holder counts (e.g. "9,926,520"). */
const formatStatValue = (value: string | number): string => {
  const { groupingSeparator, decimalSeparator } = getNumberFormatSettings();

  return new BigNumber(value).toFormat(0, BigNumber.ROUND_DOWN, {
    groupSeparator: groupingSeparator,
    groupSize: 3,
    decimalSeparator,
  });
};

/**
 * Renders only the rows the payload carries — unsourceable fields are absent,
 * not null — and hides entirely when none are, or when the gate is off.
 */
const TokenStatsSection: React.FC<TokenStatsSectionProps> = ({
  tokenId,
  network,
}) => {
  const { t } = useAppTranslation();
  const fetchStats = usePriceHistoryStore((state) => state.fetchStats);
  const entry = useTokenStatsEntry(network, tokenId);

  const isEnabled = usePriceHistoryEnabled(network);

  useEffect(() => {
    if (!isEnabled) return;
    fetchStats({ tokenId, network }).catch(() => {
      // Errors are already reported and stored by the duck; the section
      // simply stays hidden.
    });
  }, [isEnabled, fetchStats, tokenId, network]);

  if (!isEnabled || !entry) {
    return null;
  }

  const rows: ListItemProps[] = [];

  if (entry.data.supplyOnStellar !== undefined) {
    rows.push(
      makeDetailRow(
        t("priceHistory.tokenStats.supplyOnStellar"),
        formatStatValue(entry.data.supplyOnStellar),
      ),
    );
  }

  if (entry.data.holders !== undefined) {
    rows.push(
      makeDetailRow(
        t("priceHistory.tokenStats.holders"),
        formatStatValue(entry.data.holders),
      ),
    );
  }

  // No sourced rows → no section, rather than an empty card (§7.3).
  if (rows.length === 0) {
    return null;
  }

  return (
    <View className="gap-3" testID="token-stats-section">
      <Text md medium secondary>
        {t("priceHistory.tokenStats.title")}
      </Text>
      <List variant="secondary" items={rows} />
    </View>
  );
};

export default TokenStatsSection;
