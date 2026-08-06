import { BigNumber } from "bignumber.js";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import { Account } from "config/types";
import { formatFiatAmount } from "helpers/formatAmount";
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
   * Account's total USD value. `undefined` means not fetched yet; `null`
   * means unavailable (fetch failed or fiat-less network). Both render a
   * spinner while `isLoadingFiatTotal` (a failed row shows it during its
   * retry) and fall back to a zero total once loading settles, matching the
   * Home screen's always-visible fiat balance.
   */
  fiatTotal?: BigNumber | null;
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

  const handleSelectAccountPress = useCallback(() => {
    handleSelectAccount(account.publicKey);
  }, [account.publicKey, handleSelectAccount]);

  const renderFiatTotal = () => {
    // Covers both never-fetched (undefined) and failed (null) totals: a
    // failed row is retried by the next cycle, and showing the spinner
    // during the retry beats asserting a confident $0.00.
    if (fiatTotal == null && isLoadingFiatTotal) {
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
        {formatFiatAmount(fiatTotal ?? "0")}
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
        accessibilityLabel={account.name}
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
