import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, DEFAULT_PRESS_DELAY } from "config/constants";
import { logger } from "config/logger";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { Account, SecretSource } from "config/types";
import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import { useAuthenticationStore } from "ducks/auth";
import { AccountGroupKind, groupAccountsBySource } from "helpers/accountGroups";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSecretSources } from "services/auth/secretSources";

type AccountsRecoveryScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.ACCOUNTS_RECOVERY_SCREEN
>;

interface AccountRowProps {
  account: Account;
  isSelected: boolean;
  fiatTotalLabel?: string;
  isLoadingTotal: boolean;
  onEdit: (accountId: string) => void;
}

const AccountRow: React.FC<AccountRowProps> = ({
  account,
  isSelected,
  fiatTotalLabel,
  isLoadingTotal,
  onEdit,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const renderTotal = () => {
    if (!fiatTotalLabel && isLoadingTotal) {
      return (
        <ActivityIndicator
          size="small"
          color={themeColors.foreground.primary}
        />
      );
    }

    return (
      <Text sm secondary numberOfLines={1}>
        {fiatTotalLabel ?? ""}
      </Text>
    );
  };

  return (
    <View
      className="flex-row items-center gap-4"
      testID="accounts-recovery-row"
      accessibilityState={{ selected: isSelected }}
    >
      <View>
        <Avatar size="lg" publicAddress={account.publicKey} />
        {isSelected && (
          <View
            className="absolute -bottom-1 -right-1 z-20 w-6 h-6 rounded-full bg-navy-9 justify-center items-center"
            testID="accounts-recovery-selected-badge"
          >
            {/* A solid navy circle in both schemes, so the check is white. */}
            <Icon.Check size={12} color={themeColors.white} />
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text md primary medium numberOfLines={1}>
          {account.name}
        </Text>
        {renderTotal()}
      </View>
      <TouchableOpacity
        onPress={() => onEdit(account.id)}
        delayPressIn={DEFAULT_PRESS_DELAY}
        accessibilityRole="button"
        accessibilityLabel={t("accountsRecoveryScreen.editAccount", {
          name: account.name,
        })}
        hitSlop={8}
        testID="accounts-recovery-edit"
      >
        <Icon.Settings04 color={themeColors.foreground.primary} />
      </TouchableOpacity>
    </View>
  );
};

const GroupIcon: React.FC<{ kind: AccountGroupKind; color: string }> = ({
  kind,
  color,
}) => {
  switch (kind) {
    case AccountGroupKind.PHRASE:
      return <Icon.Passcode size={16} color={color} />;
    case AccountGroupKind.SECRET_KEY:
      return <Icon.Key02 size={16} color={color} />;
    default:
      return <Icon.Wallet02 size={16} color={color} />;
  }
};

/**
 * Every account in the wallet, grouped under the recovery phrase or secret
 * key that controls it, with its USD total. The active account is marked,
 * and each row opens Edit account.
 */
const AccountsRecoveryScreen: React.FC<AccountsRecoveryScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();
  const { allAccounts, getAllAccounts, network } = useAuthenticationStore();
  const { account: activeAccount } = useGetActiveAccount();
  const fiatTotals = useAccountsFiatTotalsStore((state) => state.fiatTotals);
  const isLoadingFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.isLoading,
  );
  const fetchAccountsFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.fetchAccountsFiatTotals,
  );
  const [sources, setSources] = useState<SecretSource[]>([]);

  // Refetched on focus so a rename on Edit account shows on return.
  useFocusEffect(
    useCallback(() => {
      getAllAccounts();
      getSecretSources()
        .then((map) => setSources(Object.values(map)))
        .catch((error) => {
          logger.error(
            "AccountsRecoveryScreen",
            "Failed to read secret sources",
            error,
          );
        });
    }, [getAllAccounts]),
  );

  useFocusEffect(
    useCallback(() => {
      if (allAccounts.length === 0) {
        return;
      }
      // TTL-gated, so returning to the screen doesn't refetch every time.
      fetchAccountsFiatTotals({
        publicKeys: allAccounts.map(({ publicKey }) => publicKey),
        network,
        excludePublicKey: activeAccount?.publicKey,
      });
    }, [
      allAccounts,
      network,
      activeAccount?.publicKey,
      fetchAccountsFiatTotals,
    ]),
  );

  const groups = useMemo(
    () => groupAccountsBySource({ accounts: allAccounts, sources, t }),
    [allAccounts, sources, t],
  );

  const handleEdit = useCallback(
    (accountId: string) =>
      navigation.navigate(SETTINGS_ROUTES.EDIT_ACCOUNT_SCREEN, { accountId }),
    [navigation],
  );

  return (
    <BaseLayout
      testID="accounts-recovery-screen"
      insets={{ top: false, bottom: false }}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View
          className="flex flex-col gap-6 mt-4"
          style={{ marginBottom: insets.bottom + pxValue(DEFAULT_PADDING) }}
        >
          {groups.map((group, index) => (
            <View key={group.key} className="gap-6">
              {index > 0 && <View className="h-[1px] bg-border-primary" />}
              <View className="gap-4" testID="accounts-recovery-group">
                <View className="flex-row items-center gap-2">
                  <GroupIcon
                    kind={group.kind}
                    color={themeColors.foreground.secondary}
                  />
                  <Text sm secondary medium>
                    {group.label}
                  </Text>
                </View>
                {group.accounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    isSelected={account.id === activeAccount?.id}
                    fiatTotalLabel={fiatTotals[account.publicKey]?.label}
                    isLoadingTotal={isLoadingFiatTotals}
                    onEdit={handleEdit}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </BaseLayout>
  );
};

export default AccountsRecoveryScreen;
