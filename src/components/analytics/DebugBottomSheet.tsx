import FastImage from "@d11/react-native-fast-image";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomSheet from "components/BottomSheet";
import { PinnedBottomSheetHeader } from "components/BottomSheetHeader";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { STORAGE_KEYS } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { TOKEN_ICONS_STORAGE_KEY, useTokenIconsStore } from "ducks/tokenIcons";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { getVersion } from "react-native-device-info";
import { SecurityLevel } from "services/blockaid/constants";

interface DebugBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  onDismiss: () => void;
}

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
    try {
      resetIconsCache();
      await AsyncStorage.removeItem(TOKEN_ICONS_STORAGE_KEY);
      await FastImage.clearMemoryCache();
      await FastImage.clearDiskCache();
    } catch (error) {
      Alert.alert("Cache Reset Failed", String(error));
    }
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
    // Rendered in the wrapper's scrollable mode under a pinned header: the
    // sheet fits this content and scrolls once it reaches its maximum height.
    <View className="w-full">
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
            variant="tertiary"
            onPress={handleSetVersionOverride}
            disabled={!versionInput.trim()}
          >
            Set
          </Button>
        </View>

        <View className="flex flex-row gap-2">
          {overriddenAppVersion && (
            <Button variant="secondary" sm onPress={handleClearVersionOverride}>
              {t("debug.appVersionOverride.clearOverride")}
            </Button>
          )}
          <Button
            variant="secondary"
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
          <View className="p-3 rounded-lg bg-amber-3 border border-amber-6">
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
            variant="secondary"
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
          <View className="p-3 rounded-lg bg-amber-3 border border-amber-6">
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
            variant="secondary"
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

      <View className="gap-3">
        <Text lg medium>
          {t("debug.actions")}
        </Text>
        <Button tertiary md onPress={handleSimulateSessionExpiry} isFullWidth>
          {t("debug.simulateSessionExpiry")}
        </Button>
        <Button tertiary md onPress={handleResetIconsCache} isFullWidth>
          {t("debug.resetIconsCache")}
        </Button>
        <Button tertiary md onPress={handleResetApp} isFullWidth>
          {t("debug.resetApp")}
        </Button>
      </View>
    </View>
  );
};

export const DebugBottomSheet: React.FC<DebugBottomSheetProps> = ({
  modalRef,
  onDismiss,
}) => {
  const { t } = useAppTranslation();

  // Pinned above the controls, so the title and X stay in view while they
  // scroll.
  const renderHeader = useCallback(
    () => (
      <PinnedBottomSheetHeader title={t("debug.title")} onClose={onDismiss} />
    ),
    [t, onDismiss],
  );

  // Only render in development mode
  if (!__DEV__) {
    return null;
  }

  return (
    <BottomSheet
      modalRef={modalRef}
      scrollable
      scrollViewHeaderComponent={renderHeader}
      enablePanDownToClose={false}
      customContent={<CustomContent onDismiss={onDismiss} />}
    />
  );
};
