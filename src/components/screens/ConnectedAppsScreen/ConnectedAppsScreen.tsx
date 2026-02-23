import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import { App } from "components/sds/App";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { VISUAL_DELAY_MS } from "config/constants";
import {
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useProtocolsStore } from "ducks/protocols";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useWalletKitStore } from "ducks/walletKit";
import { findMatchedProtocol } from "helpers/protocols";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useMemo, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

type ConnectedAppsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.CONNECTED_APPS_SCREEN
>;

const EmptyState: React.FC<{
  navigation: ConnectedAppsScreenProps["navigation"];
}> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { discover_enabled: discoverEnabled } = useRemoteConfigStore();

  const handleGoToDiscover = () => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK,
          state: {
            routes: [{ name: MAIN_TAB_ROUTES.TAB_DISCOVERY }],
            index: 0,
          },
        },
      ],
    });
  };

  return (
    <View className="w-full items-center bg-background-tertiary rounded-2xl px-4 py-6 gap-3">
      <Icon.NotificationBox size={24} color={themeColors.foreground.primary} />

      {discoverEnabled ? (
        <>
          <Text md secondary medium textAlign="center">
            {t("connectedApps.noConnectedDapps")}
          </Text>

          <Button xl secondary onPress={handleGoToDiscover}>
            {t("connectedApps.goToDiscover")}
          </Button>
        </>
      ) : (
        <Text md secondary medium textAlign="center">
          {t("connectedApps.noConnectedDappsNoDiscover")}
        </Text>
      )}
    </View>
  );
};

const ConnectedAppsScreen: React.FC<ConnectedAppsScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { protocols } = useProtocolsStore();
  const { activeSessions, disconnectSession, disconnectAllSessions } =
    useWalletKitStore();

  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const publicKey = account?.publicKey || "";

  // Let's use a key string to avoid re-rendering the list when
  // any random property of the activeSessions objects is updated
  const activeSessionsKey = useMemo(
    () => Object.keys(activeSessions).join(","),
    [activeSessions],
  );

  const handleDisconnectSession = (topic: string) => {
    disconnectSession({ topic, publicKey, network });
  };

  const handleDisconnectAllSessions = async () => {
    setIsDisconnecting(true);
    await disconnectAllSessions(publicKey, network);

    // Add a small delay for smooth UX
    setTimeout(() => {
      setIsDisconnecting(false);
    }, VISUAL_DELAY_MS);
  };

  /* eslint-disable @typescript-eslint/no-unsafe-member-access */
  const connectedDapps = useMemo(
    () =>
      Object.values(activeSessions).map((session) => {
        // Try to find a matched protocol for the session so we keep
        // the UI consistent with the Discovery tab icons and names
        const matchedProtocol = findMatchedProtocol({
          protocols,
          searchUrl: session.peer.metadata.url,
        });

        const dAppName = matchedProtocol?.name ?? session.peer.metadata.name;
        const dAppFavicon =
          matchedProtocol?.iconUrl ?? session.peer.metadata.icons[0];

        return {
          key: session.topic,
          icon: <App appName={dAppName} favicon={dAppFavicon} />,
          title: dAppName,
          trailingContent: (
            <TouchableOpacity
              onPress={() => handleDisconnectSession(session.topic)}
              className="w-10 h-10 items-end justify-center pr-1"
            >
              <Icon.MinusCircle size={18} themeColor="red" />
            </TouchableOpacity>
          ),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSessionsKey],
  );
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 pt-3">
        {/* Connected Dapps Section */}
        <ScrollView
          className="mb-6"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          {connectedDapps.length > 0 ? (
            <List items={connectedDapps} variant="secondary" />
          ) : (
            <EmptyState navigation={navigation} />
          )}
        </ScrollView>

        {/* Disconnect All Button - Fixed at bottom */}
        {connectedDapps.length > 0 && (
          <View className="mt-auto pt-6">
            <Button
              xl
              onPress={handleDisconnectAllSessions}
              error
              icon={
                <Icon.LinkBroken01
                  size={18}
                  color={
                    isDisconnecting
                      ? themeColors.text.secondary
                      : themeColors.red["8"]
                  }
                />
              }
              iconPosition={IconPosition.LEFT}
              isLoading={isDisconnecting}
            >
              {t("connectedApps.disconnectAllSessions")}
            </Button>
          </View>
        )}
      </View>
    </BaseLayout>
  );
};

export default ConnectedAppsScreen;
