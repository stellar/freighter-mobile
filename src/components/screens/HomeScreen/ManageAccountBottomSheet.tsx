import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BigNumber } from "bignumber.js";
import { DefaultListFooter } from "components/DefaultListFooter";
import BottomSheetAdaptiveContainer from "components/primitives/BottomSheetAdaptiveContainer";
import AccountItemRow from "components/screens/HomeScreen/AccountItemRow";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { Account } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { pxValue } from "helpers/dimensions";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { heightPercentageToDP } from "react-native-responsive-screen";

interface ManageAccountBottomSheetProps {
  handleCloseModal: () => void;
  onPressSettings: () => void;
  onPressMyQRCode: () => void;
  onPressCopyAddress: () => void;
  onPressViewOnExplorer: () => void;
  onPressRenameAccount: () => void;
  onPressAddAnotherWallet: () => void;
  accounts: Account[];
  activeAccount: ActiveAccount | null;
  handleSelectAccount: (publicKey: string) => Promise<void>;
  isAccountSwitching: boolean;
  switchingToPublicKey: string | null;
  fiatTotals: Record<string, BigNumber | null>;
  isLoadingFiatTotals: boolean;
  showAddWallet?: boolean;
}

const SNAP_VALUE_PERCENT = 80;

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

const CircleButton: React.FC<CircleButtonProps> = ({
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
);

export const ManageAccountBottomSheet: React.FC<
  ManageAccountBottomSheetProps
> = ({
  handleCloseModal,
  onPressSettings,
  onPressMyQRCode,
  onPressCopyAddress,
  onPressViewOnExplorer,
  onPressRenameAccount,
  onPressAddAnotherWallet,
  accounts,
  activeAccount,
  handleSelectAccount,
  isAccountSwitching,
  switchingToPublicKey,
  fiatTotals,
  isLoadingFiatTotals,
  showAddWallet = true,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const iconColor = themeColors.foreground.primary;
  const isSwitchInProgress =
    isAccountSwitching || switchingToPublicKey !== null;

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
    <View className="flex-1 justify-between items-center w-full relative">
      <BottomSheetAdaptiveContainer
        bottomPaddingPx={heightPercentageToDP(100 - SNAP_VALUE_PERCENT)}
        contentGapPx={pxValue(24)}
        header={
          <View className="flex-row items-center justify-between w-full">
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
              onPress={handleCloseModal}
              accessibilityLabel={t("common.close")}
              testID="manage-accounts-close-button"
            >
              <Icon.X size={HEADER_ICON_SIZE} color={iconColor} />
            </CircleButton>
          </View>
        }
      >
        <BottomSheetScrollView
          className="w-full"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
          contentContainerStyle={{
            gap: pxValue(24),
          }}
        >
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
              isSwitchingToThisAccount={
                switchingToPublicKey === account.publicKey
              }
              fiatTotal={fiatTotals[account.publicKey]}
              isLoadingFiatTotal={isLoadingFiatTotals}
              testID={`account-row-${index}`}
            />
          ))}
          <DefaultListFooter />
        </BottomSheetScrollView>
        {showAddWallet && (
          <TouchableOpacity
            className="flex-row items-center gap-[16px] w-full mt-[24px]"
            onPress={onPressAddAnotherWallet}
            disabled={isSwitchInProgress}
            accessibilityRole="button"
            testID="manage-accounts-add-wallet-button"
          >
            <View className="w-[34px] h-[34px] rounded-full bg-lilac-2 justify-center items-center">
              <Icon.Plus size={14} color={themeColors.lilac[9]} />
            </View>
            <Text md medium color={themeColors.lilac[11]}>
              {t("home.manageAccount.addWallet")}
            </Text>
          </TouchableOpacity>
        )}
      </BottomSheetAdaptiveContainer>
    </View>
  );
};

export default ManageAccountBottomSheet;
