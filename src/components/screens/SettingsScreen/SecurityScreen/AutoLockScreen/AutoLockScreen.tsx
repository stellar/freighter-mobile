import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useMemo } from "react";
import { View } from "react-native";

type AutoLockScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.AUTO_LOCK_SCREEN
>;

// Auto-lock options in milliseconds
const AUTO_LOCK_OPTIONS = [
  { value: 15 * 1000, key: "immediately" }, // Immediately (15 seconds)
  { value: 1 * 60 * 1000, key: "1minute" }, // 1 minute
  { value: 5 * 60 * 1000, key: "5minutes" }, // 5 minutes
  { value: 15 * 60 * 1000, key: "15minutes" }, // 15 minutes
  { value: 30 * 60 * 1000, key: "30minutes" }, // 30 minutes
  { value: 60 * 60 * 1000, key: "1hour" }, // 1 hour
  { value: 12 * 60 * 60 * 1000, key: "12hours" }, // 12 hours
  { value: 24 * 60 * 60 * 1000, key: "24hours" }, // 24 hours (default)
  { value: null, key: "none" }, // None
] as const;

const AutoLockScreen: React.FC<AutoLockScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { autoLockExpirationMs, setAutoLockExpirationMs } =
    usePreferencesStore();
  const { updateHashKeyExpiration } = useAuthenticationStore();

  // Default to 24 hours if not set (null means "None" option, undefined means not set yet)
  const currentValue =
    autoLockExpirationMs === undefined
      ? 24 * 60 * 60 * 1000
      : autoLockExpirationMs;

  const handleSelectOption = useCallback(
    async (value: number | null) => {
      setAutoLockExpirationMs(value);
      // Update the hash key expiration time
      await updateHashKeyExpiration();
    },
    [setAutoLockExpirationMs, updateHashKeyExpiration],
  );

  const listItems = useMemo(
    () =>
      AUTO_LOCK_OPTIONS.map((option) => ({
        title: t(`securityScreen.autoLock.options.${option.key}`),
        titleColor: themeColors.text.primary,
        onPress: () => handleSelectOption(option.value),
        trailingContent:
          currentValue === option.value ? (
            <Icon.Check color={themeColors.foreground.primary} />
          ) : undefined,
        testID: `auto-lock-option-${option.key}`,
      })),
    [t, themeColors, currentValue, handleSelectOption],
  );

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex flex-col gap-6 mt-4">
        <List items={listItems} />
        <View className="px-4">
          <Text sm secondary>
            {t("securityScreen.autoLock.description")}
          </Text>
        </View>
      </View>
    </BaseLayout>
  );
};

export default AutoLockScreen;
