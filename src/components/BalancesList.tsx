import { NavigationProp, useNavigation } from "@react-navigation/native";
import BigNumber from "bignumber.js";
import { BalanceRow } from "components/BalanceRow";
import { DefaultListFooter } from "components/DefaultListFooter";
import { EmptyState } from "components/EmptyState";
import { FriendbotButton } from "components/FriendbotButton";
import { TokenRowDivider } from "components/TokenRowStyle";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { NETWORKS, TransactionContext } from "config/constants";
import {
  ADD_FUNDS_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { PricedBalance } from "config/types";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { calculateSpendableAmount } from "helpers/balances";
import { px, pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { ReactNode, useMemo } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import styled from "styled-components/native";

const ListWrapper = styled.View`
  flex: 1;
`;

const SpinnerWrapper = styled(ListWrapper)`
  align-items: center;
  justify-content: center;
  margin-bottom: ${px(55)};
`;

const Spinner = styled.ActivityIndicator`
  margin-top: ${px(24)};
  width: 100%;
  align-items: center;
`;

// Local type that extends PricedBalance to include spendableAmount
type BalanceItemWithSpendable = PricedBalance & {
  spendableAmount?: BigNumber;
};

interface BalancesListProps {
  publicKey: string;
  network: NETWORKS;
  searchTerm?: string;
  onTokenPress?: (tokenId: string) => void;
  disableNavigation?: boolean;
  renderRightContent?: (balance: PricedBalance) => ReactNode;
  excludeTokenIds?: string[];
  disableInnerScrolling?: boolean;
  showSpendableAmount?: boolean;
  feeContext?: TransactionContext;
  /** Optional prefix for BalanceRow testIDs (e.g. "token-option" -> "token-option-XLM") */
  balanceRowTestIDPrefix?: string;
  /**
   * Whether the last row gets a divider too. Home's list ends with one;
   * Send's picker turns it off, since its collectibles section follows.
   */
  showLastRowDivider?: boolean;
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
  excludeTokenIds = [],
  disableInnerScrolling = false,
  showSpendableAmount = false,
  feeContext = TransactionContext.Send,
  balanceRowTestIDPrefix,
  showLastRowDivider = true,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { transactionFee } = useTransactionSettingsStore();
  const { swapFee } = useSwapSettingsStore();

  // Always call the hook, but handle navigation context errors gracefully
  let navigation: NavigationProp<RootStackParamList> | null = null;
  try {
    const nav = useNavigation<NavigationProp<RootStackParamList>>();
    navigation = disableNavigation ? null : nav;
  } catch {
    navigation = null;
  }

  const {
    balanceItems: allBalanceItems,
    scanResults,
    isLoading,
    error,
    noBalances,
    isRefreshing,
    isFunded,
    handleRefresh,
  } = useBalancesList({ publicKey, network, searchTerm });

  // Filter out excluded tokens and calculate spendable amounts
  const balanceItems = useMemo((): BalanceItemWithSpendable[] => {
    const currentFee =
      feeContext === TransactionContext.Swap ? swapFee : transactionFee;

    return allBalanceItems
      .filter((item) => !excludeTokenIds.includes(item.id))
      .map((item) => {
        const spendableAmount =
          showSpendableAmount && account
            ? calculateSpendableAmount({
                balance: item,
                subentryCount: account.subentryCount || 0,
                transactionFee: currentFee,
              })
            : undefined;

        return {
          ...item,
          spendableAmount,
        };
      });
  }, [
    allBalanceItems,
    excludeTokenIds,
    showSpendableAmount,
    account,
    feeContext,
    swapFee,
    transactionFee,
  ]);

  const isTestNetwork = [NETWORKS.TESTNET, NETWORKS.FUTURENET].includes(
    network,
  );

  // Display error state if there's an error loading balances (same style as
  // the collectibles grid's error state)
  if (error) {
    return (
      <ListWrapper>
        <View className="pt-4">
          <Text md secondary>
            {t("balancesList.error")}
          </Text>
        </View>
      </ListWrapper>
    );
  }

  // If no balances and still loading, show the spinner
  if (noBalances && isLoading) {
    return (
      <SpinnerWrapper>
        <Spinner
          testID="balances-list-spinner"
          size="large"
          color={themeColors.foreground.primary}
        />
      </SpinnerWrapper>
    );
  }

  // If still no balances after fetching, then show the empty state
  if (noBalances && !isFunded) {
    return (
      <ListWrapper>
        <EmptyState
          title={t("balancesList.unfundedAccount.title")}
          description={t("balancesList.unfundedAccount.description")}
          testID="unfunded-account-empty-state"
          // Figma has the card 16pt from the screen's edges and 8pt under the
          // tab row. Home's tokens contents pad 24pt at the sides and 9pt on
          // top (TokensCollectiblesTabs), so the card reaches 8pt past the
          // sides and 1pt above. Only Home shows it: Send's picker lists no
          // tokens section for an account without balances.
          style={{ marginHorizontal: -pxValue(8), marginTop: -pxValue(1) }}
        >
          {/* Only show fund account button if navigation is available and not test network */}
          {!disableNavigation && !isTestNetwork && (
            <Button
              secondary
              lg
              onPress={() =>
                navigation?.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
                  screen: ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN,
                  params: { isUnfunded: true },
                })
              }
              testID="unfunded-account-add-xlm-button"
            >
              {t("balancesList.unfundedAccount.fundAccountButton")}
            </Button>
          )}

          {/* Show friendbot button for test networks regardless of navigation */}
          {isTestNetwork && (
            <FriendbotButton publicKey={publicKey} network={network} />
          )}
        </EmptyState>
      </ListWrapper>
    );
  }

  // A balance row and the divider under it, for both the plain list and the
  // FlatList below. The last row's divider is optional.
  const renderRow = (item: BalanceItemWithSpendable, index: number) => (
    <>
      <BalanceRow
        balance={item}
        scanResult={
          item.id ? scanResults[item.id.replace(":", "-")] : undefined
        }
        onPress={
          onTokenPress && item.id ? () => onTokenPress(item.id!) : undefined
        }
        rightContent={renderRightContent ? renderRightContent(item) : undefined}
        spendableAmount={item.spendableAmount}
        testID={
          balanceRowTestIDPrefix && item.tokenCode
            ? `${balanceRowTestIDPrefix}-${item.tokenCode}`
            : undefined
        }
      />
      {(showLastRowDivider || index < balanceItems.length - 1) && (
        <TokenRowDivider />
      )}
    </>
  );

  // If scrolling is disabled, render items directly without FlatList
  if (disableInnerScrolling) {
    return (
      // A plain View, not ListWrapper's flex: 1: the rows are as tall as they
      // are, so whatever follows the list (Home's inline Add token button)
      // sits under the last row instead of at the bottom of the screen. The
      // loading, error and empty views keep flex: 1 and fill the screen.
      <View>
        {balanceItems.map((item, index) => (
          <React.Fragment key={item.id || `balance-${Math.random()}`}>
            {renderRow(item, index)}
          </React.Fragment>
        ))}
      </View>
    );
  }

  return (
    <ListWrapper>
      <FlatList
        testID="balances-list"
        showsVerticalScrollIndicator={false}
        ListFooterComponent={DefaultListFooter}
        data={balanceItems}
        renderItem={({ item, index }) => renderRow(item, index)}
        keyExtractor={(item) => item.id || `balance-${Math.random()}`}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.gray[12]}
          />
        }
      />
    </ListWrapper>
  );
};
