import { NavigationProp, useNavigation } from "@react-navigation/native";
import { BalanceRow } from "components/BalanceRow";
import { FriendbotButton } from "components/FriendbotButton";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Notification } from "components/sds/Notification";
import { Text } from "components/sds/Typography";
import { CREATE_ACCOUNT_URL, NETWORKS } from "config/constants";
import {
  BUY_XLM_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { THEME } from "config/theme";
import { PricedBalanceWithIdAndAssetType } from "config/types";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import React from "react";
import { FlatList, Linking, RefreshControl } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import styled from "styled-components/native";

const ListWrapper = styled.View`
  flex: 1;
`;

const ListTitle = styled.View`
  margin-bottom: ${px(24)};
  flex-direction: row;
  align-items: center;
  gap: ${px(6)};
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
  showTitleIcon?: boolean;
  onTokenPress?: (token: PricedBalanceWithIdAndAssetType) => void;
  searchText?: string;
  rightContent?: React.ReactNode;
  shouldUseScrollView?: boolean;
  disableFundAccount?: boolean;
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
  showTitleIcon = false,
  onTokenPress,
  searchText,
  rightContent,
  shouldUseScrollView = false,
  disableFundAccount = false,
}) => {
  const { t } = useAppTranslation();

  // Only call useNavigation if fund account functionality is not disabled
  let navigation: NavigationProp<RootStackParamList> | undefined;
  if (!disableFundAccount) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    navigation = useNavigation<NavigationProp<RootStackParamList>>();
  }

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

  const filteredBalanceItems = balanceItems.filter(
    (item) =>
      item.id.toLowerCase().includes(searchText?.toLowerCase() ?? "") ||
      item?.displayName
        ?.toLowerCase()
        ?.includes(searchText?.toLowerCase() ?? ""),
  );

  // Display error state if there's an error loading balances
  if (error) {
    return (
      <ListWrapper>
        <ListTitle>
          {showTitleIcon && (
            <Icon.Coins03 size={16} color={THEME.colors.text.primary} />
          )}
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
          {showTitleIcon && (
            <Icon.Coins03 size={16} color={THEME.colors.text.primary} />
          )}
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
          {showTitleIcon && (
            <Icon.Coins03 size={16} color={THEME.colors.text.primary} />
          )}
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

        {!isTestNetwork && navigation && (
          <Button
            isFullWidth
            tertiary
            lg
            onPress={() =>
              navigation.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
                screen: BUY_XLM_ROUTES.BUY_XLM_SCREEN,
                params: { isUnfunded: true },
              })
            }
          >
            {t("balancesList.unfundedAccount.fundAccountButton")}
          </Button>
        )}

        {isTestNetwork && (
          <FriendbotButton publicKey={publicKey} network={network} />
        )}
      </ListWrapper>
    );
  }

  return (
    <ListWrapper>
      <ListTitle>
        {showTitleIcon && (
          <Icon.Coins03 size={16} color={THEME.colors.text.primary} />
        )}
        <Text medium>{t("balancesList.title")}</Text>
      </ListTitle>
      {shouldUseScrollView ? (
        <ScrollView
          testID="balances-list-scroll-view"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          {filteredBalanceItems.map((item) => (
            <BalanceRow
              balance={item}
              onPress={onTokenPress ? () => onTokenPress(item) : undefined}
              rightContent={rightContent}
              key={item.id}
            />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          testID="balances-list"
          showsVerticalScrollIndicator={false}
          data={searchText ? filteredBalanceItems : balanceItems}
          renderItem={({ item }) => (
            <BalanceRow
              balance={item}
              onPress={onTokenPress ? () => onTokenPress(item) : undefined}
              rightContent={rightContent}
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
      )}
    </ListWrapper>
  );
};
