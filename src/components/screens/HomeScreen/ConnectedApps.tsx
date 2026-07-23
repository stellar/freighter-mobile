import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import BottomSheet from "components/BottomSheet";
import ConnectedAppsBottomSheet, {
  ConnectedDapp,
} from "components/screens/HomeScreen/ConnectedAppsBottomSheet";
import { Button } from "components/sds/Button";
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
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSessionsKey],
  );
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, [bottomSheetRef]);

  const handleDisconnectSession = useCallback(
    (topic: string) => {
      disconnectSession({ topic, publicKey, network });
    },
    [disconnectSession, publicKey, network],
  );

  const handleDisconnectAll = useCallback(async () => {
    setIsDisconnecting(true);
    await disconnectAllSessions(publicKey, network);
    setTimeout(() => setIsDisconnecting(false), VISUAL_DELAY_MS);
  }, [disconnectAllSessions, publicKey, network]);

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
      scrollViewFooterComponent={hasSessions ? renderFooter : undefined}
      customContent={
        <ConnectedAppsBottomSheet
          connectedDapps={connectedDapps}
          discoverEnabled={discoverEnabled}
          onDisconnect={handleDisconnectSession}
          onGoToDiscover={handleGoToDiscover}
          onClose={handleClose}
        />
      }
    />
  );
};

export default ConnectedApps;
