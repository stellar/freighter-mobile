import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import { Account } from "config/types";
import { AccountFiatTotal } from "ducks/accountsFiatTotals";
import { getTotalUsdLabel } from "helpers/balances";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback } from "react";
import {
  TouchableOpacity,
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

interface AccountItemRowProps {
  account: Account;
  handleSelectAccount: (publicKey: string) => Promise<void>;
  isSelected: boolean;
  isAccountSwitching: boolean;
  isSwitchingToThisAccount: boolean;
  /**
   * The account's total USD value, already resolved to what should be shown —
   * an amount, "$0.00" or "--" — by {@link getTotalUsdLabel} in the accounts
   * fiat totals store. `undefined` means not fetched yet, which renders a
   * spinner while `isLoadingFiatTotal` and a zero total once loading settles.
   */
  fiatTotal?: AccountFiatTotal;
  isLoadingFiatTotal?: boolean;
  testID?: string;
}

/**
 * One wallet row in the manage-accounts list: avatar with a selected badge,
 * name, truncated address (plus an "Imported" tag when applicable) and the
 * account's USD total — a spinner while the total is loading, and a
 * switching overlay while this account is being switched to.
 */
const AccountItemRow: React.FC<AccountItemRowProps> = ({
  account,
  handleSelectAccount,
  isSelected,
  isAccountSwitching,
  isSwitchingToThisAccount,
  fiatTotal,
  isLoadingFiatTotal = false,
  testID,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  const truncatedPublicKey = truncateAddress(account.publicKey);
  const showSelectedBadge =
    isSwitchingToThisAccount || (isSelected && !isAccountSwitching);
  // Spins only while a fetch is actually in flight for a row that has no
  // successful value: never fetched, or failed and now being retried. Once a
  // cycle settles, a failed row shows "--" rather than spinning forever, and a
  // row that already has a total keeps showing it across refreshes.
  const isTotalLoading =
    isLoadingFiatTotal && (fiatTotal == null || fiatTotal.hasError);
  // No entry yet (idle before the first cycle) means nothing is known about
  // this account, so route that through the same helper rather than hardcoding
  // a second zero string.
  const fiatTotalLabel =
    fiatTotal?.label ??
    getTotalUsdLabel({
      hasError: false,
      hasPriceFeed: false,
      isFunded: false,
      hasPrices: false,
    });

  // Announce what the row shows — name, imported marker and USD total (only
  // once one is actually displayed, never a placeholder $0.00 mid-load).
  // The truncated address is deliberately left out: spoken character soup
  // identifies the account worse than its name does.
  const rowAccessibilityLabel = [
    account.name,
    account.importedFromSecretKey ? t("home.account.imported") : null,
    isTotalLoading ? null : fiatTotalLabel,
  ]
    .filter(Boolean)
    .join(", ");

  const handleSelectAccountPress = useCallback(() => {
    handleSelectAccount(account.publicKey);
  }, [account.publicKey, handleSelectAccount]);

  const renderFiatTotal = () => {
    if (isTotalLoading) {
      return (
        <ActivityIndicator
          size="small"
          color={themeColors.foreground.primary}
          testID={testID ? `${testID}-total-spinner` : undefined}
        />
      );
    }

    return (
      <Text md medium primary testID={testID ? `${testID}-total` : undefined}>
        {fiatTotalLabel}
      </Text>
    );
  };

  return (
    <View
      className="w-full"
      style={{ opacity: isSwitchingToThisAccount ? 0.5 : 1 }}
      testID={testID}
    >
      <TouchableOpacity
        className="flex-row items-center gap-[16px]"
        onPress={handleSelectAccountPress}
        disabled={isAccountSwitching}
        delayPressIn={DEFAULT_PRESS_DELAY}
        testID={testID ? `${testID}-select` : undefined}
        accessibilityRole="button"
        accessibilityLabel={rowAccessibilityLabel}
        accessibilityState={{
          selected: showSelectedBadge,
          disabled: isAccountSwitching,
        }}
      >
        <View>
          <Avatar size="lg" publicAddress={account.publicKey} />
          {showSelectedBadge && (
            <View
              className="absolute -bottom-1 -right-1 z-20 w-6 h-6 rounded-full bg-navy-9 justify-center items-center"
              testID={testID ? `${testID}-selected-badge` : undefined}
            >
              <Icon.Check size={12} color={themeColors.base[1]} />
            </View>
          )}
        </View>
        <View className="flex-1">
          <Text md primary medium numberOfLines={1}>
            {account.name}
          </Text>
          <View className="flex-row items-center">
            <View className="shrink">
              <Text sm secondary numberOfLines={1}>
                {truncatedPublicKey}
              </Text>
            </View>
            {account.importedFromSecretKey && (
              <Text sm secondary>
                {` • ${t("home.account.imported")}`}
              </Text>
            )}
          </View>
        </View>
        {renderFiatTotal()}
      </TouchableOpacity>
      {isSwitchingToThisAccount && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: "transparent",
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
          pointerEvents="none"
        >
          <ActivityIndicator
            size="small"
            color={themeColors.foreground.primary}
          />
        </View>
      )}
    </View>
  );
};

// Memoized: rendered per account in the manage-accounts list, so a row only
// re-renders when its own props change.
export default React.memo(AccountItemRow);
