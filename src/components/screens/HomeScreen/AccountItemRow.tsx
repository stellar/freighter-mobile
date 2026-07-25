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
   * Account's total USD value. `undefined` while it hasn't been fetched yet,
   * `null` when unavailable (fetch failed or fiat-less network) — both render
   * as a zero total, matching the Home screen's always-visible fiat balance.
   */
  fiatTotal?: BigNumber | null;
  isLoadingFiatTotal?: boolean;
  testID?: string;
}

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
    if (fiatTotal === undefined && isLoadingFiatTotal) {
      return (
        <Text md medium secondary>
          ...
        </Text>
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

export default AccountItemRow;
