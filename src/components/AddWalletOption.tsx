import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

/** The 16pt glyph inside the option's 32pt circle. */
export const ADD_WALLET_OPTION_ICON_SIZE = 16;

interface AddWalletOptionProps {
  /** Rendered at ADD_WALLET_OPTION_ICON_SIZE in `foreground.secondary`. */
  icon: React.ReactNode;
  title: string;
  description?: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * The circled icon of an add-wallet option, also used by Create new wallet's
 * Add account rows.
 */
export const AddWalletOptionIcon: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <View className="w-8 h-8 rounded-full bg-gray-4 items-center justify-center">
    {children}
  </View>
);

/**
 * One way to add a wallet: a card with a circled icon, a title and a line
 * of description. Shared by Add account and Create new wallet.
 */
const AddWalletOption: React.FC<AddWalletOptionProps> = ({
  icon,
  title,
  description,
  onPress,
  testID,
  accessibilityLabel,
}) => {
  const { themeColors } = useColors();

  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 bg-background-tertiary rounded-[16px] p-4"
      onPress={onPress}
      delayPressIn={DEFAULT_PRESS_DELAY}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <AddWalletOptionIcon>{icon}</AddWalletOptionIcon>
      <View className="flex-1">
        <Text md medium primary>
          {title}
        </Text>
        {description ? (
          <Text sm color={themeColors.foreground.secondary}>
            {description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

export default AddWalletOption;
