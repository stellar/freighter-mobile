import { BigNumber } from "bignumber.js";
import { DefaultListFooter } from "components/DefaultListFooter";
import AccountItemRow from "components/screens/HomeScreen/AccountItemRow";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { Account } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ManageAccountBottomSheetProps {
  onPressMyQRCode: () => void;
  onPressCopyAddress: () => void;
  onPressViewOnExplorer: () => void;
  onPressRenameAccount: () => void;
  accounts: Account[];
  activeAccount: ActiveAccount | null;
  handleSelectAccount: (publicKey: string) => Promise<void>;
  isAccountSwitching: boolean;
  switchingToPublicKey: string | null;
  fiatTotals: Record<string, BigNumber | null>;
  isLoadingFiatTotals: boolean;
}

interface ManageAccountSheetHeaderProps {
  onPressSettings: () => void;
  onPressClose: () => void;
}

const HEADER_ICON_SIZE = 24;
const ACTION_ICON_SIZE = 20;

interface CircleButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  /** Full size classes, e.g. "w-[40px] h-[40px]" (must be static for NativeWind) */
  sizeClassName: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
}

// Memoized: rendered via the quick-actions map below.
const CircleButton: React.FC<CircleButtonProps> = React.memo(
  ({
    children,
    onPress,
    sizeClassName,
    accessibilityLabel,
    disabled,
    testID,
  }) => (
    <TouchableOpacity
      className={`${sizeClassName} rounded-full bg-background-tertiary justify-center items-center`}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </TouchableOpacity>
  ),
);

CircleButton.displayName = "CircleButton";

/**
 * Settings/close row pinned above the manage-accounts sheet's scrollable
 * content (rendered via the BottomSheet wrapper's scrollViewHeaderComponent,
 * hence the opaque background).
 */
export const ManageAccountSheetHeader: React.FC<
  ManageAccountSheetHeaderProps
> = ({ onPressSettings, onPressClose }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const iconColor = themeColors.foreground.primary;

  return (
    <View className="bg-background-primary flex-row items-center justify-between w-full px-6 pt-6 pb-[24px]">
      <CircleButton
        sizeClassName="w-[40px] h-[40px]"
        onPress={onPressSettings}
        accessibilityLabel={t("home.actions.settings")}
        testID="manage-accounts-settings-button"
      >
        <Icon.Settings02 size={HEADER_ICON_SIZE} color={iconColor} />
      </CircleButton>
      <CircleButton
        sizeClassName="w-[40px] h-[40px]"
        onPress={onPressClose}
        accessibilityLabel={t("common.close")}
        testID="manage-accounts-close-button"
      >
        <Icon.X size={HEADER_ICON_SIZE} color={iconColor} />
      </CircleButton>
    </View>
  );
};

export const ManageAccountBottomSheet: React.FC<
  ManageAccountBottomSheetProps
> = ({
  onPressMyQRCode,
  onPressCopyAddress,
  onPressViewOnExplorer,
  onPressRenameAccount,
  accounts,
  activeAccount,
  handleSelectAccount,
  isAccountSwitching,
  switchingToPublicKey,
  fiatTotals,
  isLoadingFiatTotals,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();

  const iconColor = themeColors.foreground.primary;

  const activeAccountActions = [
    {
      icon: <Icon.QrCode02 size={ACTION_ICON_SIZE} color={iconColor} />,
      onPress: onPressMyQRCode,
      accessibilityLabel: t("home.actions.myQRCode"),
      testID: "manage-accounts-qr-button",
    },
    {
      icon: <Icon.Copy01 size={ACTION_ICON_SIZE} color={iconColor} />,
      onPress: onPressCopyAddress,
      accessibilityLabel: t("home.manageAccount.copyAddress"),
      testID: "manage-accounts-copy-button",
    },
    {
      icon: <Icon.LinkExternal01 size={ACTION_ICON_SIZE} color={iconColor} />,
      onPress: onPressViewOnExplorer,
      accessibilityLabel: t("home.manageAccount.viewOnExplorer"),
      testID: "manage-accounts-explorer-button",
    },
    {
      icon: <Icon.Edit01 size={ACTION_ICON_SIZE} color={iconColor} />,
      onPress: onPressRenameAccount,
      accessibilityLabel: t("home.manageAccount.renameWallet"),
      testID: "manage-accounts-rename-button",
    },
  ];

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
        <Text md secondary>
          {truncateAddress(activeAccount?.publicKey ?? "")}
        </Text>
      </View>
      <View className="flex-row justify-center gap-[16px]">
        {activeAccountActions.map((action) => (
          <CircleButton
            key={action.testID}
            sizeClassName="w-[48px] h-[48px]"
            onPress={action.onPress}
            disabled={isAccountSwitching}
            accessibilityLabel={action.accessibilityLabel}
            testID={action.testID}
          >
            {action.icon}
          </CircleButton>
        ))}
      </View>
      <View className="w-full border-b border-border-primary" />
      {accounts.map((account, index) => (
        <AccountItemRow
          key={account.publicKey}
          account={account}
          handleSelectAccount={handleSelectAccount}
          isSelected={account.publicKey === activeAccount?.publicKey}
          isAccountSwitching={isAccountSwitching}
          isSwitchingToThisAccount={switchingToPublicKey === account.publicKey}
          fiatTotal={fiatTotals[account.publicKey]}
          isLoadingFiatTotal={isLoadingFiatTotals}
          testID={`account-row-${index}`}
        />
      ))}
      {/*
        Scroll-end clearance must live in the scrollable content: the
        wrapper's inset padding is a ScrollView *style*, which doesn't add
        scroll extent on Android. insets.bottom covers devices whose
        navigation bar overlaps the sheet (e.g. 48dp three-button bars, where
        the 40dp spacer alone isn't enough).
      */}
      <View
        testID="manage-accounts-list-end-spacing"
        style={{ paddingBottom: insets.bottom }}
      >
        <DefaultListFooter />
      </View>
    </View>
  );
};

export default ManageAccountBottomSheet;
