import { AssetIcon } from "components/AssetIcon";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { THEME } from "config/theme";
import { PricedBalance } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { isLiquidityPool } from "helpers/balances";
import { px } from "helpers/dimensions";
import {
  formatAssetAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import styled from "styled-components/native";

const ListWrapper = styled.View`
  flex: 1;
`;

const ListTitle = styled.View`
  margin-bottom: ${px(24)};
`;

const Spinner = styled.ActivityIndicator`
  margin-top: ${px(24)};
  width: 100%;
  align-items: center;
`;

const BalanceRow = styled.View`
  flex-direction: row;
  width: 100%;
  height: ${px(44)};
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${px(24)};
`;

const LeftSection = styled.View`
  flex-direction: row;
  align-items: center;
  flex: 1;
  margin-right: ${px(16)};
`;

const AssetTextContainer = styled.View`
  flex-direction: column;
  margin-left: ${px(16)};
  flex: 1;
`;

interface RightSectionProps {
  isLP: boolean;
}

const RightSection = styled.View<RightSectionProps>`
  flex-direction: column;
  align-items: flex-end;
  /* For liquidity pool balances we only need 20px for the "--" string */
  width: ${({ isLP }: RightSectionProps) => px(isLP ? 20 : 115)};
`;

/**
 * Extended PricedBalance type with an id field for use in FlatList
 */
type BalanceItem = PricedBalance & {
  id: string;
};

/**
 * BalancesList Component Props
 */
interface BalancesListProps {
  publicKey: string;
  network: NETWORKS;
}

/**
 * BalancesList Component
 *
 * A component that displays a user's token balances in a scrollable list.
 * Features include:
 * - Displays regular tokens and liquidity pool tokens
 * - Shows token balances with corresponding fiat values
 * - Displays 24h price changes with color indicators
 * - Supports pull-to-refresh to update balances and prices
 * - Shows loading, error, and empty states
 *
 * @param {BalancesListProps} props - Component props
 * @returns {JSX.Element} A FlatList of balance items or an empty state message
 */
export const BalancesList: React.FC<BalancesListProps> = ({
  publicKey,
  network,
}) => {
  const { t } = useAppTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounting, setIsMounting] = useState(true);

  const {
    pricedBalances,
    isLoading: isBalancesLoading,
    error: balancesError,
    fetchAccountBalances,
  } = useBalancesStore();

  // Set isMounting to false after the component mounts.
  // This is used to prevent the "no balances" state from showing
  // for a fraction of second while the store is setting the
  // isBalancesLoading flag. We could revisit this after
  // we finish implementing the auth flow as it could be
  // naturally solved by that.
  useEffect(() => {
    setIsMounting(false);
  }, []);

  /**
   * Handles manual refresh via pull-to-refresh gesture
   * Ensures the refresh spinner is visible for at least 1 second for a better UX
   */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

    // Start fetching balances and prices
    fetchAccountBalances({
      publicKey,
      network,
    });

    // Add a minimum spinner delay to prevent flickering
    new Promise((resolve) => {
      setTimeout(resolve, 1000);
    }).finally(() => {
      setIsRefreshing(false);
    });
  }, [fetchAccountBalances, publicKey, network]);

  // Display error state if there's an error loading balances
  if (balancesError) {
    return (
      <ListWrapper>
        <ListTitle>
          <Text medium>{t("balancesList.title")}</Text>
        </ListTitle>
        <Text md>{t("balancesList.error")}</Text>
      </ListWrapper>
    );
  }

  // If no balances or loading, show empty state
  if (Object.keys(pricedBalances).length === 0) {
    return (
      <ListWrapper>
        <ListTitle>
          <Text medium>{t("balancesList.title")}</Text>
        </ListTitle>

        {isBalancesLoading || isMounting ? (
          <Spinner
            testID="balances-list-spinner"
            size="large"
            color={THEME.colors.secondary}
          />
        ) : (
          <Text md>{t("balancesList.empty")}</Text>
        )}
      </ListWrapper>
    );
  }

  // Convert balances object to array for FlatList
  const balanceItems: BalanceItem[] = Object.entries(pricedBalances).map(
    ([id, balance]) =>
      ({
        id,
        ...balance,
      }) as BalanceItem,
  );

  /**
   * Renders an individual balance item in the list
   * Handles both regular tokens and liquidity pool tokens
   * Displays token name, amount, fiat value, and price change
   *
   * @param {Object} params - The render item parameters
   * @param {BalanceItem} params.item - The balance item to render
   * @returns {JSX.Element} The rendered balance row
   */
  const renderItem = ({ item }: { item: BalanceItem }) => (
    <BalanceRow>
      <LeftSection>
        <AssetIcon token={item} />
        <AssetTextContainer>
          <Text medium numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text sm medium secondary numberOfLines={1}>
            {formatAssetAmount(item.total, item.tokenCode)}
          </Text>
        </AssetTextContainer>
      </LeftSection>
      <RightSection isLP={isLiquidityPool(item)}>
        {item.fiatTotal ? (
          <>
            <Text medium numberOfLines={1}>
              {formatFiatAmount(item.fiatTotal)}
            </Text>
            <Text
              sm
              medium
              color={
                item.percentagePriceChange24h?.gt(0)
                  ? THEME.colors.status.success
                  : THEME.colors.text.secondary
              }
            >
              {formatPercentageAmount(item.percentagePriceChange24h)}
            </Text>
          </>
        ) : (
          <Text sm medium secondary>
            --
          </Text>
        )}
      </RightSection>
    </BalanceRow>
  );

  return (
    <ListWrapper>
      <ListTitle>
        <Text medium>{t("balancesList.title")}</Text>
      </ListTitle>
      <FlatList
        testID="balances-list"
        showsVerticalScrollIndicator={false}
        data={balanceItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isBalancesLoading}
            onRefresh={handleRefresh}
            tintColor={THEME.colors.secondary}
          />
        }
      />
    </ListWrapper>
  );
};
