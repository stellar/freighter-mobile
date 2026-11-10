import { PinnedBottomSheetHeader } from "components/BottomSheetHeader";
import AccountItemRow from "components/screens/HomeScreen/AccountItemRow";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { Account, SecretSource } from "config/types";
import { AccountFiatTotal } from "ducks/accountsFiatTotals";
import { ActiveAccount } from "ducks/auth";
import { groupAccountsBySource } from "helpers/accountGroups";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo, useState } from "react";
import { TouchableOpacity, View } from "react-native";

interface ManageAccountBottomSheetProps {
  onPressCopyAddress: () => void;
  accounts: Account[];
  /** The wallet's secret sources; null until read, which holds the list back
   * so it doesn't draw ungrouped and then regroup. */
  sources: SecretSource[] | null;
  activeAccount: ActiveAccount | null;
  handleSelectAccount: (publicKey: string) => Promise<void>;
  isAccountSwitching: boolean;
  switchingToPublicKey: string | null;
  fiatTotals: Record<string, AccountFiatTotal>;
  isLoadingFiatTotals: boolean;
}

interface ManageAccountSheetHeaderProps {
  onPressSettings: () => void;
  onPressClose: () => void;
}

const HEADER_ICON_SIZE = 24;
const COPY_ICON_SIZE = 14;

/*
  Groups the user collapsed, kept for the rest of the app session so the
  sheet reopens the way they left it. Module scope, like the extension, so it
  outlives the sheet's content, which unmounts on every dismiss.
*/
const collapsedGroupKeys = new Set<string>();

/**
 * Settings/close row pinned above the manage-accounts sheet's scrollable
 * content (rendered via the BottomSheet wrapper's scrollViewHeaderComponent,
 * hence the opaque background). Per the manage-wallets frame: a plain gear on
 * the left, the plain X on the right, no title.
 */
export const ManageAccountSheetHeader: React.FC<
  ManageAccountSheetHeaderProps
> = ({ onPressSettings, onPressClose }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <PinnedBottomSheetHeader
      spaceBelow={16}
      layout="stacked"
      leading={
        <TouchableOpacity
          onPress={onPressSettings}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t("home.actions.settings")}
          testID="manage-accounts-settings-button"
        >
          <Icon.Settings02
            size={HEADER_ICON_SIZE}
            color={themeColors.foreground.primary}
          />
        </TouchableOpacity>
      }
      onClose={onPressClose}
      closeTestID="manage-accounts-close-button"
    />
  );
};

/**
 * Scrollable body of the manage-accounts sheet: the active wallet's avatar,
 * name and address (with an inline copy button), then the wallets grouped by
 * the secret that controls them, each with its USD total. Rename and the
 * explorer link live on Edit account. Presentation-only: every action and the
 * switching state are owned by the ManageAccounts wrapper.
 */
export const ManageAccountBottomSheet: React.FC<
  ManageAccountBottomSheetProps
> = ({
  onPressCopyAddress,
  accounts,
  sources,
  activeAccount,
  handleSelectAccount,
  isAccountSwitching,
  switchingToPublicKey,
  fiatTotals,
  isLoadingFiatTotals,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(collapsedGroupKeys),
  );

  const groups = useMemo(
    () => (sources ? groupAccountsBySource({ accounts, sources, t }) : []),
    [accounts, sources, t],
  );

  const toggleGroup = (key: string) => {
    if (collapsedGroupKeys.has(key)) {
      collapsedGroupKeys.delete(key);
    } else {
      collapsedGroupKeys.add(key);
    }
    setCollapsed(new Set(collapsedGroupKeys));
  };

  // Row test ids follow the wallet's position in the full list, so they don't
  // shift when a group above collapses.
  const renderRows = (rows: Account[]) =>
    rows.map((account) => (
      <AccountItemRow
        key={account.publicKey}
        account={account}
        handleSelectAccount={handleSelectAccount}
        isSelected={account.publicKey === activeAccount?.publicKey}
        isAccountSwitching={isAccountSwitching}
        isSwitchingToThisAccount={switchingToPublicKey === account.publicKey}
        fiatTotal={fiatTotals[account.publicKey]}
        isLoadingFiatTotal={isLoadingFiatTotals}
        testID={`account-row-${accounts.indexOf(account)}`}
      />
    ));

  const renderList = () => {
    // One source has nothing to tell apart, and collapsing it would only hide
    // the whole list, so a single group renders flat.
    if (groups.length <= 1) {
      return renderRows(accounts);
    }

    return groups.map((group, index) => {
      const isExpanded = !collapsed.has(group.key);

      return (
        <View key={group.key} className="gap-[16px]">
          {index > 0 && (
            <View className="w-full border-b border-border-primary" />
          )}
          <View className="gap-[16px]" testID="manage-accounts-group">
            <TouchableOpacity
              className="flex-row items-center justify-between gap-[16px]"
              onPress={() => toggleGroup(group.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
              testID="manage-accounts-group-toggle"
            >
              <Text sm medium secondary>
                {group.label}
              </Text>
              <View
                style={{
                  transform: [{ rotate: isExpanded ? "0deg" : "-90deg" }],
                }}
              >
                <Icon.ChevronDown
                  size={16}
                  color={themeColors.foreground.secondary}
                />
              </View>
            </TouchableOpacity>
            {isExpanded && renderRows(group.accounts)}
          </View>
        </View>
      );
    });
  };

  return (
    <View className="w-full gap-[24px]">
      <View className="items-center">
        <Avatar
          size="xxl"
          publicAddress={activeAccount?.publicKey ?? ""}
          testID="manage-accounts-active-avatar"
        />
      </View>
      <View className="items-center">
        <Text xl medium primary numberOfLines={1}>
          {activeAccount?.accountName ?? ""}
        </Text>
        <View className="flex-row items-center gap-[6px]">
          <Text md secondary>
            {truncateAddress(activeAccount?.publicKey ?? "")}
          </Text>
          <TouchableOpacity
            onPress={onPressCopyAddress}
            disabled={isAccountSwitching}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t("home.manageAccount.copyAddress")}
            testID="manage-accounts-copy-button"
          >
            <Icon.Copy01
              size={COPY_ICON_SIZE}
              color={themeColors.foreground.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View className="w-full border-b border-border-primary" />
      {/* Own gap: rows sit 16px apart, tighter than the 24px rhythm that
      separates the hero and the list as a whole. Skipped entirely when there
      are no rows, or until the sources are read: an empty wrapper is still a
      flex child, so it would claim a 24px slot in the column and leave a
      blank band while the list loads. */}
      {accounts.length > 0 && sources && (
        <View className="w-full gap-[16px]" testID="manage-accounts-list">
          {renderList()}
        </View>
      )}
    </View>
  );
};

export default ManageAccountBottomSheet;
