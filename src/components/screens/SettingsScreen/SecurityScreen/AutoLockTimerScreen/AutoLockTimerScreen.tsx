import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { AUTO_LOCK_TIMER, DEFAULT_PADDING } from "config/constants";
import { logger } from "config/logger";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { usePreferencesStore } from "ducks/preferences";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useToast } from "providers/ToastProvider";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
// TODO/FIXME: only needed for the temporary dev inputs — remove with them
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  clearDevAutoLockTimer,
  getDevAutoLockTimerMs,
  setDevAutoLockTimerSeconds,
  setDevHashKeyTtlSeconds,
} from "services/autoLock";

interface AutoLockTimerScreenProps
  extends NativeStackScreenProps<
    SettingsStackParamList,
    typeof SETTINGS_ROUTES.AUTO_LOCK_TIMER_SCREEN
  > {}

// TODO/FIXME: dev-only testing labels — remove with the block below
const DEV_BANNER = "⚠️ DEV ONLY — remove before production";
const DEV_TIMER_LABEL = "Auto-lock timer (seconds)";
const DEV_TTL_LABEL = "Hash key TTL (seconds)";
const DEV_APPLY = "Apply";
const DEV_TIMER_PLACEHOLDER = "e.g. 10";
const DEV_TTL_PLACEHOLDER = "e.g. 30";

const AutoLockTimerScreen: React.FC<AutoLockTimerScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { showToast } = useToast();
  const { autoLockTimer, setAutoLockTimer } = usePreferencesStore();

  // TODO/FIXME: dev-only state for the testing controls — remove before prod
  const [devTimerSeconds, setDevTimerSecondsInput] = useState("");
  const [devTtlSeconds, setDevTtlSecondsInput] = useState("");
  // When a custom dev timer is active, the enum options are deselected so the
  // UI reflects that the override (not a preset) governs the lock.
  const [isDevTimerActive, setIsDevTimerActive] = useState(false);

  useEffect(() => {
    getDevAutoLockTimerMs()
      .then((ms) => setIsDevTimerActive(ms !== null))
      .catch(() => setIsDevTimerActive(false));
  }, []);

  // TODO/FIXME: dev-only handlers — remove before prod
  const applyDevTimer = () => {
    const seconds = Number(devTimerSeconds);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }
    setDevAutoLockTimerSeconds(seconds)
      .then(() => {
        setIsDevTimerActive(true);
        showToast({
          variant: "success",
          title: `Auto-lock timer set to ${seconds}s`,
          toastId: "dev-auto-lock-timer",
        });
      })
      .catch((error) =>
        logger.error("AutoLockTimerScreen", "Failed to set dev timer", error),
      );
  };
  const applyDevTtl = () => {
    const seconds = Number(devTtlSeconds);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }
    setDevHashKeyTtlSeconds(seconds)
      .then(() =>
        showToast({
          variant: "success",
          title: `Hash key TTL set to ${seconds}s`,
          toastId: "dev-hash-key-ttl",
        }),
      )
      .catch((error) =>
        logger.error("AutoLockTimerScreen", "Failed to set dev TTL", error),
      );
  };

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
    // TODO/FIXME: picking a preset clears the dev override so it takes effect
    setIsDevTimerActive(false);
    clearDevAutoLockTimer().catch((error) =>
      logger.error("AutoLockTimerScreen", "Failed to clear dev timer", error),
    );
  };

  const listItems = Object.values(AUTO_LOCK_TIMER).map((option) => ({
    title: timerLabels[option],
    titleColor: themeColors.text.primary,
    onPress: () => handleSelectOption(option),
    trailingContent: (
      <Icon.Check
        color={
          !isDevTimerActive && autoLockTimer === option
            ? themeColors.base[1]
            : "transparent"
        }
      />
    ),
    testID: `auto-lock-option-${option}`,
  }));

  return (
    <BaseLayout insets={{ top: false }}>
      {/*
        TODO / FIXME: the KeyboardAwareScrollView wrapper exists only so the
        temporary dev inputs below aren't hidden behind the keyboard.
        REVERT to the plain <View> when removing the dev-only block.
      */}
      <KeyboardAwareScrollView
        contentContainerClassName="flex flex-col gap-4 mt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={DEFAULT_PADDING}
      >
        <List items={listItems} />
        <Text sm secondary>
          {t("autoLockTimerScreen.footer")}
        </Text>

        {/*
          ====================================================================
          TODO / FIXME: TEMPORARY DEV-ONLY testing controls.
          !!! REMOVE THIS ENTIRE BLOCK BEFORE MERGING TO PRODUCTION !!!
          (also remove the dev helpers in services/autoLock.ts, the
          getDevAutoLockTimerMs override in ducks/auth.ts, and revert the
          KeyboardAwareScrollView wrapper above back to a plain <View>)
          Lets QA exercise the lock flows in seconds instead of minutes/hours.
          ====================================================================
        */}
        <View className="flex flex-col gap-3 mt-6">
          <Text sm medium color={themeColors.status.error}>
            {DEV_BANNER}
          </Text>
          <Input
            fieldSize="md"
            label={DEV_TIMER_LABEL}
            placeholder={DEV_TIMER_PLACEHOLDER}
            keyboardType="number-pad"
            value={devTimerSeconds}
            onChangeText={setDevTimerSecondsInput}
            endButton={{ content: DEV_APPLY, onPress: applyDevTimer }}
          />
          <Input
            fieldSize="md"
            label={DEV_TTL_LABEL}
            placeholder={DEV_TTL_PLACEHOLDER}
            keyboardType="number-pad"
            value={devTtlSeconds}
            onChangeText={setDevTtlSecondsInput}
            endButton={{ content: DEV_APPLY, onPress: applyDevTtl }}
          />
        </View>
        {/* ================= END TEMPORARY DEV-ONLY BLOCK ================= */}
      </KeyboardAwareScrollView>
    </BaseLayout>
  );
};

export default AutoLockTimerScreen;
