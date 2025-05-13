import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { List } from "components/List";
import { QRScanner } from "components/QRScanner";
import { BaseLayout } from "components/layout/BaseLayout";
import { App } from "components/sds/App";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Display, Text } from "components/sds/Typography";
import { VISUAL_DELAY_MS } from "config/constants";
import { MainTabStackParamList, MAIN_TAB_ROUTES } from "config/routes";
import { useWalletKitStore } from "ducks/walletKit";
import { walletKit } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useMemo, useState } from "react";
import { TouchableOpacity, View, ScrollView } from "react-native";

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getClipboardText } = useClipboard();
  const { activeSessions, disconnectAllSessions } = useWalletKitStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [dappUri, setDappUri] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState("");

  // Let's use a key string to avoid re-rendering the list when
  // any random property of the activeSessions objects is updated
  const activeSessionsKey = useMemo(
    () => Object.keys(activeSessions).join(","),
    [activeSessions],
  );

  /* eslint-disable @typescript-eslint/no-unsafe-member-access */
  const connectedDapps = useMemo(
    () =>
      Object.values(activeSessions).map((session) => ({
        icon: (
          <App
            appName={session.peer.metadata.name}
            favicon={session.peer.metadata.icons[0]}
          />
        ),
        title: session.peer.metadata.name,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSessionsKey],
  );
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */

  const handleClearUri = () => {
    setDappUri("");
    setError("");
  };

  const handlePasteFromClipboard = () => {
    getClipboardText().then(setDappUri);
  };

  const handleConnect = async (uri: string) => {
    if (!uri) {
      setError(t("discovery.invalidUriError"));
      return;
    }

    setIsConnecting(true);
    setError("");

    try {
      await walletKit.pair({ uri });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("discovery.pairingError"),
      );
    } finally {
      // Add a delay for a smooth UX while we wait for the bottom sheet to animate
      setTimeout(() => {
        setIsConnecting(false);
      }, 4000);
    }
  };

  const handleOnRead = (uri: string) => {
    setDappUri(uri);
    setShowScanner(false);
    handleConnect(uri);
  };

  const handleDisconnectAllSessions = async () => {
    setIsDisconnecting(true);
    await disconnectAllSessions();

    // Add a small delay for smooth UX
    setTimeout(() => {
      setIsDisconnecting(false);
    }, VISUAL_DELAY_MS);
  };

  if (showScanner) {
    return (
      <BaseLayout insets={{ bottom: false }}>
        <TouchableOpacity
          onPress={() => setShowScanner(false)}
          className="w-10 h-10 mb-2 flex items-center justify-center z-[999]"
        >
          <Icon.X size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <QRScanner onRead={handleOnRead} />
      </BaseLayout>
    );
  }

  return (
    <BaseLayout insets={{ bottom: false }}>
      <Display sm style={{ alignSelf: "center" }}>
        {t("discovery.title")}
      </Display>

      <View className="mt-10 gap-4 mb-4">
        <Input
          placeholder={t("discovery.inputPlaceholder")}
          fieldSize="lg"
          value={dappUri}
          onChangeText={setDappUri}
          error={error}
          leftElement={
            <Icon.Link04 size={16} color={themeColors.foreground.primary} />
          }
          rightElement={
            <TouchableOpacity className="p-3 mr-1" onPress={handleClearUri}>
              <Icon.XClose size={16} color={themeColors.foreground.primary} />
            </TouchableOpacity>
          }
          endButton={{
            content: t("common.paste"),
            onPress: handlePasteFromClipboard,
          }}
        />

        <Button
          lg
          onPress={() => setShowScanner(true)}
          secondary
          icon={<Icon.Scan />}
          iconPosition={IconPosition.LEFT}
        >
          {t("discovery.scanQRCode")}
        </Button>

        <Button
          lg
          onPress={() => handleConnect(dappUri)}
          primary
          icon={
            <Icon.Link04
              color={
                dappUri.length === 0
                  ? themeColors.text.secondary
                  : themeColors.text.primary
              }
            />
          }
          iconPosition={IconPosition.LEFT}
          disabled={dappUri.length === 0}
          isLoading={isConnecting}
        >
          {t("discovery.connect")}
        </Button>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="mt-10 gap-4 pb-16"
        showsVerticalScrollIndicator={false}
      >
        <Display xs>{t("discovery.connectedDapps")}</Display>

        {connectedDapps.length > 0 ? (
          <>
            <List items={connectedDapps} />
            <Button
              lg
              onPress={handleDisconnectAllSessions}
              destructive
              icon={<Icon.LinkBroken01 color={themeColors.text.primary} />}
              iconPosition={IconPosition.LEFT}
              isLoading={isDisconnecting}
            >
              {t("discovery.disconnectAllSessions")}
            </Button>
          </>
        ) : (
          <Text>{t("discovery.noConnectedDapps")}</Text>
        )}
      </ScrollView>
    </BaseLayout>
  );
};
