import { NavigationProp, useNavigation } from "@react-navigation/native";
import { BalanceRow } from "components/BalanceRow";
import { FriendbotButton } from "components/FriendbotButton";
import { Button } from "components/sds/Button";
import { Notification } from "components/sds/Notification";
import { Text } from "components/sds/Typography";
import { CREATE_ACCOUNT_TUTORIAL_URL, NETWORKS } from "config/constants";
import {
  BUY_XLM_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { THEME } from "config/theme";
import { PricedBalance } from "config/types";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import React, { ReactNode } from "react";
import { FlatList, Linking, RefreshControl, View } from "react-native";
import styled from "styled-components/native";

const ListWrapper = styled.View`
  flex: 1;
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
  searchTerm?: string;
  onTokenPress?: (tokenId: string) => void;
  disableNavigation?: boolean;
  renderRightContent?: (balance: PricedBalance) => ReactNode;
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
  searchTerm,
  onTokenPress,
  disableNavigation = false,
  renderRightContent,
}) => {
  const { t } = useAppTranslation();

  // Always call the hook, but handle navigation context errors gracefully
  let navigation: NavigationProp<RootStackParamList> | null = null;
  try {
    const nav = useNavigation<NavigationProp<RootStackParamList>>();
    navigation = disableNavigation ? null : nav;
  } catch {
    navigation = null;
  }

  const {
    balanceItems,
    isLoading,
    error,
    noBalances,
    isRefreshing,
    isFunded,
    handleRefresh,
  } = useBalancesList({ publicKey, network, shouldPoll: true, searchTerm });

  const isTestNetwork = [NETWORKS.TESTNET, NETWORKS.FUTURENET].includes(
    network,
  );

  // Display error state if there's an error loading balances
  if (error) {
    return (
      <ListWrapper>
        <Text md>{t("balancesList.error")}</Text>
      </ListWrapper>
    );
  }

  // If no balances and still loading, show the spinner
  if (noBalances && isLoading) {
    return (
      <ListWrapper>
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
        <NotificationWrapper>
          <Notification
            variant="primary"
            onPress={() => {
              Linking.openURL(CREATE_ACCOUNT_TUTORIAL_URL);
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

        {/* Only show fund account button if navigation is available and not test network */}
        {!disableNavigation && !isTestNetwork && (
          <Button
            isFullWidth
            tertiary
            lg
            onPress={() =>
              navigation?.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
                screen: BUY_XLM_ROUTES.BUY_XLM_SCREEN,
                params: { isUnfunded: true },
              })
            }
          >
            {t("balancesList.unfundedAccount.fundAccountButton")}
          </Button>
        )}

        {/* Show friendbot button for test networks regardless of navigation */}
        {isTestNetwork && (
          <FriendbotButton publicKey={publicKey} network={network} />
        )}
      </ListWrapper>
    );
  }

  return (
    <ListWrapper>
      <FlatList
        testID="balances-list"
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View className="h-10" />}
        data={balanceItems}
        renderItem={({ item }) => (
          <BalanceRow
            balance={item}
            onPress={onTokenPress ? () => onTokenPress(item.id) : undefined}
            rightContent={
              renderRightContent ? renderRightContent(item) : undefined
            }
          />
        )}
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
