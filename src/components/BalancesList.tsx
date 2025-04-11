import { BalanceRow } from "components/BalanceRow";
import { FriendbotButton } from "components/FriendbotButton";
import { Notification } from "components/sds/Notification";
import { Text } from "components/sds/Typography";
import { CREATE_ACCOUNT_URL, NETWORKS } from "config/constants";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import React from "react";
import { FlatList, Linking, RefreshControl } from "react-native";
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

const NotificationWrapper = styled.View`
  margin-bottom: ${px(24)};
`;

const NotificationContent = styled.View`
  flex-direction: row;
  align-items: center;
`;

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
  const {
    balanceItems,
    isLoading,
    error,
    noBalances,
    isRefreshing,
    isFunded,
    handleRefresh,
  } = useBalancesList({ publicKey, network, shouldPoll: true });

  const isTestNetwork = [NETWORKS.TESTNET, NETWORKS.FUTURENET].includes(
    network,
  );

  // Display error state if there's an error loading balances
  if (error) {
    return (
      <ListWrapper>
        <ListTitle>
          <Text medium>{t("balancesList.title")}</Text>
        </ListTitle>
        <Text md>{t("balancesList.error")}</Text>
      </ListWrapper>
    );
  }

  // If no balances and still loading, show the spinner
  if (noBalances && isLoading) {
    return (
      <ListWrapper>
        <ListTitle>
          <Text medium>{t("balancesList.title")}</Text>
        </ListTitle>

        <Spinner
          testID="balances-list-spinner"
          size="large"
          color={THEME.colors.secondary}
        />
      </ListWrapper>
    );
  }

  // If still no balances after fetching, then show the empty state
  if (noBalances && !isFunded) {
    return (
      <ListWrapper>
        <ListTitle>
          <Text medium>{t("balancesList.title")}</Text>
        </ListTitle>

        <NotificationWrapper>
          <Notification
            variant="primary"
            onPress={() => {
              Linking.openURL(CREATE_ACCOUNT_URL);
            }}
            customContent={
              <NotificationContent>
                <Text sm>
                  {t("balancesList.unfundedAccount.message")}{" "}
                  <Text sm semiBold color={THEME.colors.primary}>
                    {t("balancesList.unfundedAccount.learnMore")}
                  </Text>
                </Text>
              </NotificationContent>
            }
          />
        </NotificationWrapper>

        {isTestNetwork && (
          <FriendbotButton publicKey={publicKey} network={network} />
        )}
      </ListWrapper>
    );
  }

  return (
    <ListWrapper>
      <ListTitle>
        <Text medium>{t("balancesList.title")}</Text>
      </ListTitle>
      <FlatList
        testID="balances-list"
        showsVerticalScrollIndicator={false}
        data={balanceItems}
        renderItem={({ item }) => <BalanceRow balance={item} />}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isLoading}
            onRefresh={handleRefresh}
            tintColor={THEME.colors.secondary}
          />
        }
      />
    </ListWrapper>
  );
};
