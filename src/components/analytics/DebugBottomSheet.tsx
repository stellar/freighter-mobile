import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomSheet from "components/BottomSheet";
import BottomSheetAdaptiveContainer from "components/primitives/BottomSheetAdaptiveContainer";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { STORAGE_KEYS } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { TOKEN_ICONS_STORAGE_KEY, useTokenIconsStore } from "ducks/tokenIcons";
import { formatTimeAgo } from "helpers/date";
import { toPercent } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { Image, View, TouchableOpacity } from "react-native";
import { getVersion } from "react-native-device-info";
import { heightPercentageToDP } from "react-native-responsive-screen";
import { analytics } from "services/analytics";
import { DEBUG_CONSTANTS } from "services/analytics/debug";
import { SecurityLevel } from "services/blockaid/constants";

interface DebugBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  onDismiss: () => void;
}

const SNAP_VALUE_PERCENT = 90;

enum TransactionFailureMode {
  NONE = "none",
  BUILD = "build",
  SIGN = "sign",
  SUBMIT = "submit",
  SWAP_PATH = "swapPath",
}

const CustomContent: React.FC<{
  onDismiss: () => void;
}> = ({ onDismiss }) => {
  const [debugInfo, setDebugInfo] = useState(analytics.getAnalyticsDebugInfo());
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { logout, devResetAppAuth } = useAuthenticationStore();
  const { resetIconsCache } = useTokenIconsStore();
  const {
    overriddenAppVersion,
    setOverriddenAppVersion,
    clearOverriddenAppVersion,
    overriddenBlockaidResponse,
    setOverriddenBlockaidResponse,
    clearOverriddenBlockaidResponse,
    forceBuildTransactionFailure,
    forceSignTransactionFailure,
    forceSubmitTransactionFailure,
    setForceBuildTransactionFailure,
    setForceSignTransactionFailure,
    setForceSubmitTransactionFailure,
    clearAllTransactionFailures,
    forceSwapPathFailure,
    setForceSwapPathFailure,
    clearSwapPathDebug,
  } = useDebugStore();
  const [versionInput, setVersionInput] = useState(overriddenAppVersion || "");
  const [currentVersion] = useState(getVersion());

  // Determine the currently active transaction failure mode
  const getActiveFailureMode = (): TransactionFailureMode => {
    if (forceBuildTransactionFailure) return TransactionFailureMode.BUILD;
    if (forceSignTransactionFailure) return TransactionFailureMode.SIGN;
    if (forceSubmitTransactionFailure) return TransactionFailureMode.SUBMIT;
    if (forceSwapPathFailure) return TransactionFailureMode.SWAP_PATH;
    return TransactionFailureMode.NONE;
  };

  const activeFailureMode = getActiveFailureMode();

  const setActiveFailureMode = (mode: TransactionFailureMode): void => {
    const setterMap: Record<TransactionFailureMode, () => void> = {
      [TransactionFailureMode.NONE]: () => {
        clearAllTransactionFailures();
        clearSwapPathDebug();
      },
      [TransactionFailureMode.BUILD]: () => {
        clearAllTransactionFailures();
        clearSwapPathDebug();
        setForceBuildTransactionFailure(true);
      },
      [TransactionFailureMode.SIGN]: () => {
        clearAllTransactionFailures();
        clearSwapPathDebug();
        setForceSignTransactionFailure(true);
      },
      [TransactionFailureMode.SUBMIT]: () => {
        clearAllTransactionFailures();
        clearSwapPathDebug();
        setForceSubmitTransactionFailure(true);
      },
      [TransactionFailureMode.SWAP_PATH]: () => {
        clearAllTransactionFailures();
        clearSwapPathDebug();
        setForceSwapPathFailure(true);
      },
    };

    setterMap[mode]();
  };

  const handleRefresh = () => {
    setDebugInfo(analytics.getAnalyticsDebugInfo());
  };

  const handleClearEvents = () => {
    analytics.clearRecentEvents();

    setDebugInfo(analytics.getAnalyticsDebugInfo());
  };

  const handleSimulateSessionExpiry = () => {
    onDismiss();

    // Simulate session expiry by doing a partial logout
    // This keeps accounts but clears sensitive data, forcing re-authentication
    logout(false); // false = don't wipe all data, just expire session
  };

  const handleResetApp = () => {
    devResetAppAuth();
    // Conditionally require DevSettings only in dev mode
    // This prevents dev support libraries from being bundled in production
    if (__DEV__) {
      /* eslint-disable */
      const { DevSettings } = require("react-native");
      DevSettings.reload();
      /* eslint-enable */
    }
    onDismiss();
  };

  const handleResetIconsCache = async () => {
    resetIconsCache();
    await AsyncStorage.removeItem(TOKEN_ICONS_STORAGE_KEY);

    const imageCache = Image as typeof Image & {
      clearMemoryCache?: () => void | Promise<void>;
      clearDiskCache?: () => void | Promise<void>;
    };

    await imageCache.clearMemoryCache?.();
    await imageCache.clearDiskCache?.();
  };

  const handleClearUpdateDismissalFlag = async () => {
    await AsyncStorage.removeItem(
      STORAGE_KEYS.APP_UPDATE_DISMISSED_REQUIRED_VERSION,
    );
  };

  const handleSetVersionOverride = () => {
    if (versionInput.trim()) {
      setOverriddenAppVersion(versionInput.trim());
    } else {
      clearOverriddenAppVersion();
    }
  };

  const handleClearVersionOverride = () => {
    setVersionInput("");
    clearOverriddenAppVersion();
  };

  return (
    <View className="flex-1 w-full">
      <BottomSheetAdaptiveContainer
        header={
          <View className="flex-row justify-between items-center mb-4">
            <Text xl medium>
              {t("debug.title")}
            </Text>
            <TouchableOpacity onPress={onDismiss}>
              <Icon.X color={themeColors.text.primary} />
            </TouchableOpacity>
          </View>
        }
        bottomPaddingPx={heightPercentageToDP(100 - SNAP_VALUE_PERCENT)}
      >
        <BottomSheetScrollView
          className="w-full"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          <View className="gap-3 mb-4">
            <Text lg medium>
              {t("analytics.debug.status")}
            </Text>
            <View className="flex-row gap-4">
              <View className="flex-1 p-3 rounded-lg bg-background-secondary">
                <Text
                  sm
                  medium
                  color={
                    debugInfo.isEnabled
                      ? themeColors.status.success
                      : themeColors.status.error
                  }
                >
                  {debugInfo.isEnabled
                    ? t("analytics.debug.enabled")
                    : t("analytics.debug.disabled")}
                </Text>
              </View>
              <View className="flex-1 p-3 rounded-lg bg-background-secondary">
                <Text
                  sm
                  medium
                  color={
                    debugInfo.hasInitialized
                      ? themeColors.status.success
                      : themeColors.status.warning
                  }
                >
                  {debugInfo.hasInitialized
                    ? t("analytics.debug.initialized")
                    : t("analytics.debug.notInitialized")}
                </Text>
              </View>
            </View>

            <View className="p-3 rounded-lg bg-background-secondary">
              <Text
                sm
                medium
                color={
                  debugInfo.isSendingToAmplitude
                    ? themeColors.status.success
                    : themeColors.status.warning
                }
              >
                {debugInfo.isSendingToAmplitude
                  ? t("analytics.debug.sending")
                  : t("analytics.debug.notSending")}
              </Text>
            </View>

            {debugInfo.amplitudeKey === DEBUG_CONSTANTS.API_KEY_NOT_SET && (
              <View className="p-3 rounded-lg border-2 border-amber-500 bg-amber-50">
                <Text sm semiBold color={themeColors.status.warning}>
                  {t("analytics.debug.apiKeyMissing")}
                </Text>
                <Text xs color={themeColors.status.warning}>
                  {t("analytics.debug.apiKeyMissingWarning")}
                </Text>
              </View>
            )}

            <View className="gap-2">
              <Text sm secondary>
                {debugInfo.userId
                  ? t("analytics.debug.userId", { userId: debugInfo.userId })
                  : t("analytics.debug.userIdNotSet")}
              </Text>
              <Text sm secondary>
                {t("analytics.debug.environment", {
                  environment: debugInfo.environment,
                })}
              </Text>
              <Text sm secondary>
                {t("analytics.debug.apiKey", {
                  apiKey: debugInfo.amplitudeKey,
                })}
              </Text>
            </View>
          </View>

          {/* App Version Override Section */}
          <View className="gap-3 mb-4">
            <Text lg medium>
              {t("debug.appVersionOverride.title")}
            </Text>
            <Text xs color={themeColors.text.secondary}>
              {t("debug.appVersionOverride.description")}
            </Text>

            <View className="flex flex-col gap-2">
              <Text xs color={themeColors.text.secondary}>
                {t("debug.appVersionOverride.currentVersion", {
                  version: currentVersion,
                })}
              </Text>

              {overriddenAppVersion && (
                <Text xs color={themeColors.status.warning}>
                  {t("debug.appVersionOverride.overriddenVersion", {
                    version: overriddenAppVersion,
                  })}
                </Text>
              )}
            </View>

            <View className="flex flex-row gap-2">
              <View className="flex-1">
                <Input
                  placeholder={t("debug.appVersionOverride.placeholder")}
                  value={versionInput}
                  onChangeText={setVersionInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Button
                variant="secondary"
                onPress={handleSetVersionOverride}
                disabled={!versionInput.trim()}
              >
                Set
              </Button>
            </View>

            <View className="flex flex-row gap-2">
              {overriddenAppVersion && (
                <Button
                  variant="tertiary"
                  sm
                  onPress={handleClearVersionOverride}
                >
                  {t("debug.appVersionOverride.clearOverride")}
                </Button>
              )}
              <Button
                variant="tertiary"
                sm
                onPress={handleClearUpdateDismissalFlag}
              >
                {t("debug.appVersionOverride.clearUpdateDismissalFlag")}
              </Button>
            </View>
          </View>

          {/* Blockaid Response Override Section */}
          <View className="gap-3 mb-4">
            <Text lg medium>
              {t("debug.blockaidOverride.title")}
            </Text>
            <Text xs color={themeColors.text.secondary}>
              {t("debug.blockaidOverride.description")}
            </Text>

            {overriddenBlockaidResponse && (
              <View className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <Text xs color={themeColors.status.warning}>
                  {t("debug.blockaidOverride.overriddenResponse", {
                    response: overriddenBlockaidResponse,
                  })}
                </Text>
              </View>
            )}

            <View className="flex flex-row gap-2 flex-wrap">
              <Button
                variant={
                  overriddenBlockaidResponse === SecurityLevel.SAFE
                    ? "primary"
                    : "secondary"
                }
                sm
                onPress={() => {
                  const level: SecurityLevel = SecurityLevel.SAFE;
                  setOverriddenBlockaidResponse(level);
                }}
              >
                {t("debug.blockaidOverride.safe")}
              </Button>
              <Button
                variant={
                  overriddenBlockaidResponse === SecurityLevel.SUSPICIOUS
                    ? "primary"
                    : "secondary"
                }
                sm
                onPress={() => {
                  const level: SecurityLevel = SecurityLevel.SUSPICIOUS;
                  setOverriddenBlockaidResponse(level);
                }}
              >
                {t("debug.blockaidOverride.suspicious")}
              </Button>
              <Button
                variant={
                  overriddenBlockaidResponse === SecurityLevel.MALICIOUS
                    ? "primary"
                    : "secondary"
                }
                sm
                onPress={() => {
                  const level: SecurityLevel = SecurityLevel.MALICIOUS;
                  setOverriddenBlockaidResponse(level);
                }}
              >
                {t("debug.blockaidOverride.malicious")}
              </Button>
              <Button
                variant={
                  overriddenBlockaidResponse === SecurityLevel.UNABLE_TO_SCAN
                    ? "primary"
                    : "secondary"
                }
                sm
                onPress={() => {
                  const level: SecurityLevel = SecurityLevel.UNABLE_TO_SCAN;
                  setOverriddenBlockaidResponse(level);
                }}
              >
                {t("debug.blockaidOverride.unableToScan")}
              </Button>
            </View>

            {overriddenBlockaidResponse && (
              <Button
                variant="tertiary"
                sm
                onPress={clearOverriddenBlockaidResponse}
              >
                {t("debug.blockaidOverride.clearOverride")}
              </Button>
            )}
          </View>

          {/* Swap Failure Overrides Section */}
          <View className="gap-3 mb-4">
            <Text lg medium>
              {t("debug.transactionFailure.title")}
            </Text>
            <Text xs color={themeColors.text.secondary}>
              {t("debug.transactionFailure.description")}
            </Text>

            {activeFailureMode !== TransactionFailureMode.NONE && (
              <View className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <Text xs color={themeColors.status.warning}>
                  {t("debug.transactionFailure.activeOverrides")}
                </Text>
                {activeFailureMode === TransactionFailureMode.BUILD && (
                  <Text xs color={themeColors.status.warning}>
                    • {t("debug.transactionFailure.buildActive")}
                  </Text>
                )}
                {activeFailureMode === TransactionFailureMode.SIGN && (
                  <Text xs color={themeColors.status.warning}>
                    • {t("debug.transactionFailure.signActive")}
                  </Text>
                )}
                {activeFailureMode === TransactionFailureMode.SUBMIT && (
                  <Text xs color={themeColors.status.warning}>
                    • {t("debug.transactionFailure.submitActive")}
                  </Text>
                )}
                {activeFailureMode === TransactionFailureMode.SWAP_PATH && (
                  <Text xs color={themeColors.status.warning}>
                    • {t("debug.transactionFailure.swapPathForceActive")}
                  </Text>
                )}
              </View>
            )}

            <View className="flex flex-col gap-2">
              <Button
                variant={
                  activeFailureMode === TransactionFailureMode.BUILD
                    ? "destructive"
                    : "secondary"
                }
                sm
                onPress={() => {
                  if (activeFailureMode === TransactionFailureMode.BUILD) {
                    setActiveFailureMode(TransactionFailureMode.NONE);
                  } else {
                    setActiveFailureMode(TransactionFailureMode.BUILD);
                  }
                }}
              >
                {activeFailureMode === TransactionFailureMode.BUILD
                  ? t("debug.transactionFailure.buildEnabled")
                  : t("debug.transactionFailure.buildDisabled")}
              </Button>

              <Button
                variant={
                  activeFailureMode === TransactionFailureMode.SIGN
                    ? "destructive"
                    : "secondary"
                }
                sm
                onPress={() => {
                  if (activeFailureMode === TransactionFailureMode.SIGN) {
                    setActiveFailureMode(TransactionFailureMode.NONE);
                  } else {
                    setActiveFailureMode(TransactionFailureMode.SIGN);
                  }
                }}
              >
                {activeFailureMode === TransactionFailureMode.SIGN
                  ? t("debug.transactionFailure.signEnabled")
                  : t("debug.transactionFailure.signDisabled")}
              </Button>

              <Button
                variant={
                  activeFailureMode === TransactionFailureMode.SUBMIT
                    ? "destructive"
                    : "secondary"
                }
                sm
                onPress={() => {
                  if (activeFailureMode === TransactionFailureMode.SUBMIT) {
                    setActiveFailureMode(TransactionFailureMode.NONE);
                  } else {
                    setActiveFailureMode(TransactionFailureMode.SUBMIT);
                  }
                }}
              >
                {activeFailureMode === TransactionFailureMode.SUBMIT
                  ? t("debug.transactionFailure.submitEnabled")
                  : t("debug.transactionFailure.submitDisabled")}
              </Button>

              <Button
                variant={
                  activeFailureMode === TransactionFailureMode.SWAP_PATH
                    ? "destructive"
                    : "secondary"
                }
                sm
                onPress={() => {
                  if (activeFailureMode === TransactionFailureMode.SWAP_PATH) {
                    setActiveFailureMode(TransactionFailureMode.NONE);
                  } else {
                    setActiveFailureMode(TransactionFailureMode.SWAP_PATH);
                  }
                }}
              >
                {activeFailureMode === TransactionFailureMode.SWAP_PATH
                  ? t("debug.transactionFailure.swapPathForceEnabled")
                  : t("debug.transactionFailure.swapPathForceDisabled")}
              </Button>
            </View>

            {activeFailureMode !== TransactionFailureMode.NONE && (
              <Button
                variant="tertiary"
                sm
                onPress={() => {
                  clearAllTransactionFailures();
                  clearSwapPathDebug();
                }}
              >
                {t("debug.transactionFailure.clearAll")}
              </Button>
            )}
          </View>

          <View className="gap-3 mb-4">
            <View className="flex-row justify-between items-center">
              <Text lg medium>
                {t("analytics.debug.recentEvents", {
                  count: debugInfo.recentEvents.length,
                })}
              </Text>
              {debugInfo.recentEvents.length > 0 && (
                <TouchableOpacity onPress={handleClearEvents}>
                  <Text sm medium color={themeColors.status.error}>
                    {t("analytics.debug.clear")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {debugInfo.recentEvents.length === 0 ? (
              <View className="p-4 rounded-lg bg-background-secondary">
                <Text sm secondary textAlign="center">
                  {t("analytics.debug.noRecentEvents")}
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {debugInfo.recentEvents.slice(0, 10).map((event) => (
                  <View
                    key={`${event.event}-${event.timestamp}`}
                    className="p-3 rounded-lg bg-background-secondary"
                  >
                    <View className="flex-row justify-between items-center mb-1">
                      <Text sm medium numberOfLines={1}>
                        {event.event}
                      </Text>
                      <Text xs secondary>
                        {formatTimeAgo(event.timestamp)}
                      </Text>
                    </View>
                    {event.props && Object.keys(event.props).length > 0 && (
                      <Text xs secondary numberOfLines={3}>
                        {JSON.stringify(event.props, null, 2)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </BottomSheetScrollView>
        <View className="gap-3">
          <Text lg medium>
            {t("analytics.debug.actions")}
          </Text>
          <Button secondary md onPress={handleRefresh} isFullWidth>
            {t("analytics.debug.refresh")}
          </Button>
          <Button
            secondary
            md
            onPress={handleSimulateSessionExpiry}
            isFullWidth
          >
            {t("analytics.debug.simulateSessionExpiry")}
          </Button>
          <Button secondary md onPress={handleResetIconsCache} isFullWidth>
            {t("analytics.debug.resetIconsCache")}
          </Button>
          <Button secondary md onPress={handleResetApp} isFullWidth>
            {t("analytics.debug.resetApp")}
          </Button>
        </View>
        <View className="h-10" />
      </BottomSheetAdaptiveContainer>
    </View>
  );
};

export const DebugBottomSheet: React.FC<DebugBottomSheetProps> = ({
  modalRef,
  onDismiss,
}) => {
  // Only render in development mode
  if (!__DEV__) {
    return null;
  }

  return (
    <BottomSheet
      modalRef={modalRef}
      handleCloseModal={onDismiss}
      snapPoints={[toPercent(SNAP_VALUE_PERCENT)]}
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      useInsetsBottomPadding={false}
      customContent={<CustomContent onDismiss={onDismiss} />}
    />
  );
};
