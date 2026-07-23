import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import BottomSheet from "components/BottomSheet";
import ConnectedAppsBottomSheet, {
  ConnectedDapp,
} from "components/screens/HomeScreen/ConnectedAppsBottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { DEFAULT_PADDING, VISUAL_DELAY_MS } from "config/constants";
import {
  MainTabStackParamList,
  RootStackParamList,
  MAIN_TAB_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useProtocolsStore } from "ducks/protocols";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useWalletKitStore } from "ducks/walletKit";
import { pxValue } from "helpers/dimensions";
import { findMatchedProtocol } from "helpers/protocols";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ConnectedAppsProps {
  navigation?: BottomTabNavigationProp<
    MainTabStackParamList & RootStackParamList,
    typeof MAIN_TAB_ROUTES.TAB_HOME
  >;
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
}

const ConnectedApps: React.FC<ConnectedAppsProps> = ({
  navigation,
  bottomSheetRef,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { showToast } = useToast();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { protocols } = useProtocolsStore();
  const { activeSessions, disconnectSession, disconnectAllSessions } =
    useWalletKitStore();
  const { discover_enabled: discoverEnabled } = useRemoteConfigStore();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const publicKey = account?.publicKey || "";

  // Key string avoids re-computing the list when unrelated session
  // properties change; only additions/removals matter here.
  const activeSessionsKey = useMemo(
    () => Object.keys(activeSessions).join(","),
    [activeSessions],
  );

  /* eslint-disable @typescript-eslint/no-unsafe-member-access */
  const connectedDapps = useMemo<ConnectedDapp[]>(
    () =>
      Object.values(activeSessions).map((session) => {
        const matchedProtocol = findMatchedProtocol({
          protocols,
          searchUrl: session.peer.metadata.url,
        });
        return {
          topic: session.topic,
          name: matchedProtocol?.name ?? session.peer.metadata.name,
          favicon: matchedProtocol?.iconUrl ?? session.peer.metadata.icons[0],
        };
      }),
    // activeSessions is intentionally proxied via activeSessionsKey (only
    // additions/removals should recompute); protocols must be listed so the
    // canonical name/icon appear once the protocols store loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSessionsKey, protocols],
  );
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, [bottomSheetRef]);

  const handleDisconnectSession = useCallback(
    (topic: string) => {
      // Capture the name before disconnecting removes it from the list.
      const appName = connectedDapps.find((dapp) => dapp.topic === topic)?.name;
      disconnectSession({ topic, publicKey, network })
        .then(() => {
          showToast({
            variant: "success",
            title: appName
              ? t("connectedApps.appDisconnected", { appName })
              : t("connectedApps.appDisconnectedFallback"),
            toastId: `app-disconnected-${topic}`,
          });
        })
        .catch(() => {
          showToast({
            variant: "error",
            title: t("connectedApps.disconnectError"),
            toastId: `app-disconnect-error-${topic}`,
          });
        });
    },
    [connectedDapps, disconnectSession, publicKey, network, showToast, t],
  );

  const handleDisconnectAll = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await disconnectAllSessions(publicKey, network);
      showToast({
        variant: "success",
        title: t("connectedApps.allAppsDisconnected"),
        toastId: "all-apps-disconnected",
      });
    } catch {
      showToast({
        variant: "error",
        title: t("connectedApps.disconnectError"),
        toastId: "all-apps-disconnect-error",
      });
    } finally {
      setTimeout(() => setIsDisconnecting(false), VISUAL_DELAY_MS);
    }
  }, [disconnectAllSessions, publicKey, network, showToast, t]);

  // Defer navigation until the sheet has finished dismissing (see
  // `handleDismiss`) so the transition isn't abrupt.
  const shouldNavigateToDiscoverRef = useRef(false);

  const handleGoToDiscover = useCallback(() => {
    shouldNavigateToDiscoverRef.current = true;
    handleClose();
  }, [handleClose]);

  const handleDismiss = useCallback(() => {
    if (!shouldNavigateToDiscoverRef.current) return;
    shouldNavigateToDiscoverRef.current = false;
    navigation?.navigate(MAIN_TAB_ROUTES.TAB_DISCOVERY);
  }, [navigation]);

  const hasSessions = connectedDapps.length > 0;

  // Pinned in the sheet handle so the title and close button stay accessible
  // while the app list scrolls.
  const renderStickyHeader = useCallback(
    () => (
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <Text xl medium>
          {t("connectedApps.title")}
        </Text>
        <TouchableOpacity
          onPress={handleClose}
          className="size-10 items-center justify-center rounded-full bg-background-tertiary"
          testID="connected-apps-close-button"
        >
          <Icon.X color={themeColors.foreground.primary} />
        </TouchableOpacity>
      </View>
    ),
    [t, handleClose, themeColors],
  );

  const renderFooter = useCallback(
    () => (
      <View
        className="w-full px-6 pt-6 mt-6 bg-background-primary"
        style={{ paddingBottom: insets.bottom + pxValue(DEFAULT_PADDING) }}
      >
        <Button
          xl
          error
          isFullWidth
          isLoading={isDisconnecting}
          onPress={handleDisconnectAll}
        >
          {t("connectedApps.disconnectAllSessions")}
        </Button>
      </View>
    ),
    [insets.bottom, isDisconnecting, handleDisconnectAll, t],
  );

  return (
    <BottomSheet
      modalRef={bottomSheetRef}
      handleCloseModal={handleClose}
      scrollable
      useInsetsBottomPadding={false}
      maxDynamicContentSize={windowHeight * 0.9}
      bottomSheetModalProps={{ onDismiss: handleDismiss }}
      analyticsEvent={AnalyticsEvent.VIEW_MANAGE_CONNECTED_APPS}
      stickyHeaderComponent={renderStickyHeader}
      scrollViewFooterComponent={hasSessions ? renderFooter : undefined}
      customContent={
        <ConnectedAppsBottomSheet
          connectedDapps={connectedDapps}
          discoverEnabled={discoverEnabled}
          onDisconnect={handleDisconnectSession}
          onGoToDiscover={handleGoToDiscover}
        />
      }
    />
  );
};

export default ConnectedApps;
