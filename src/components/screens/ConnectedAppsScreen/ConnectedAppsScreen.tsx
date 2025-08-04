import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import { App } from "components/sds/App";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { VISUAL_DELAY_MS } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useWalletKitStore } from "ducks/walletKit";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useMemo, useState } from "react";
import { TouchableOpacity, View } from "react-native";

const ConnectedAppsScreen: React.FC = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
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
      Object.values(activeSessions).map((session) => ({
        key: session.topic,
        icon: (
          <App
            appName={session.peer.metadata.name}
            favicon={session.peer.metadata.icons[0]}
          />
        ),
        title: session.peer.metadata.name,
        trailingContent: (
          <TouchableOpacity
            onPress={() => handleDisconnectSession(session.topic)}
            className="w-10 h-10 items-end justify-center pr-1"
          >
            <Icon.MinusCircle size={18} color={themeColors.red["9"]} />
          </TouchableOpacity>
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSessionsKey],
  );
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 pt-3">
        {/* Connected Dapps Section */}
        <View className="mb-6">
          {connectedDapps.length > 0 ? (
            <List items={connectedDapps} className="bg-background-tertiary" />
          ) : (
            <Text sm secondary>
              {t("connectedApps.noConnectedDapps")}
              {t("connectedApps.goToDiscover")}
            </Text>
          )}
        </View>

        {/* Disconnect All Button - Fixed at bottom */}
        {connectedDapps.length > 0 && (
          <View className="mt-auto pt-6">
            <Button
              xl
              onPress={handleDisconnectAllSessions}
              error
              icon={
                <Icon.LinkBroken01 size={18} color={themeColors.red["8"]} />
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
