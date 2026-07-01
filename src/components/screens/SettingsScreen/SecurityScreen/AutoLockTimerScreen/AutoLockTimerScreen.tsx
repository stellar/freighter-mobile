import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AUTO_LOCK_TIMER } from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { usePreferencesStore } from "ducks/preferences";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

interface AutoLockTimerScreenProps
  extends NativeStackScreenProps<
    SettingsStackParamList,
    typeof SETTINGS_ROUTES.AUTO_LOCK_TIMER_SCREEN
  > {}

const AutoLockTimerScreen: React.FC<AutoLockTimerScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { autoLockTimer, setAutoLockTimer } = usePreferencesStore();

  const timerLabels: Record<AUTO_LOCK_TIMER, string> = {
    [AUTO_LOCK_TIMER.IMMEDIATELY]: t("autoLockTimerScreen.options.immediately"),
    [AUTO_LOCK_TIMER.ONE_MINUTE]: t("autoLockTimerScreen.options.oneMinute"),
    [AUTO_LOCK_TIMER.FIFTEEN_MINUTES]: t(
      "autoLockTimerScreen.options.fifteenMinutes",
    ),
    [AUTO_LOCK_TIMER.THIRTY_MINUTES]: t(
      "autoLockTimerScreen.options.thirtyMinutes",
    ),
    [AUTO_LOCK_TIMER.ONE_HOUR]: t("autoLockTimerScreen.options.oneHour"),
    [AUTO_LOCK_TIMER.TWELVE_HOURS]: t(
      "autoLockTimerScreen.options.twelveHours",
    ),
    [AUTO_LOCK_TIMER.TWENTY_FOUR_HOURS]: t(
      "autoLockTimerScreen.options.twentyFourHours",
    ),
    [AUTO_LOCK_TIMER.NONE]: t("autoLockTimerScreen.options.none"),
  };

  const handleSelectOption = (option: AUTO_LOCK_TIMER) => {
    setAutoLockTimer(option);
  };

  const listItems = Object.values(AUTO_LOCK_TIMER).map((option) => ({
    title: timerLabels[option],
    titleColor: themeColors.text.primary,
    onPress: () => handleSelectOption(option),
    trailingContent: (
      <Icon.Check
        color={autoLockTimer === option ? themeColors.base[1] : "transparent"}
      />
    ),
    testID: `auto-lock-option-${option}`,
  }));

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex flex-col gap-4 mt-4">
        <List items={listItems} />
        <Text sm secondary>
          {t("autoLockTimerScreen.footer")}
        </Text>
      </View>
    </BaseLayout>
  );
};

export default AutoLockTimerScreen;
