import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { List } from "components/List";
import { QRScanner } from "components/QRScanner";
import { App } from "components/sds/App";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { VISUAL_DELAY_MS } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useWalletKitStore } from "ducks/walletKit";
import { pxValue } from "helpers/dimensions";
import { walletKit } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useMemo, useState } from "react";
import { TouchableOpacity, View } from "react-native";

interface ConnectedAppsBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  onDismiss: () => void;
}

const ConnectedAppsCustomContent: React.FC<{
  onDismiss: () => void;
}> = ({ onDismiss }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getClipboardText } = useClipboard();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { activeSessions, disconnectAllSessions } = useWalletKitStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [dappUri, setDappUri] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState("");

  const publicKey = account?.publicKey || "";

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
        key: session.topic,
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
      setError(t("connectedApps.invalidUriError"));
      return;
    }

    setIsConnecting(true);
    setError("");

    try {
      await walletKit.pair({ uri });

      // Add a delay for a smooth UX while we wait for the bottom sheet to animate
      setTimeout(() => {
        setIsConnecting(false);

        // Consume the input value to clean the UI
        setDappUri("");
      }, 3000);
    } catch (err) {
      // Add a delay for a smooth UX to prevent UI flickering when displaying the error
      setTimeout(() => {
        setIsConnecting(false);
        setError(
          err instanceof Error ? err.message : t("connectedApps.pairingError"),
        );
      }, 1000);
    }
  };

  const handleOnRead = (uri: string) => {
    setDappUri(uri);
    setShowScanner(false);
    handleConnect(uri);
  };

  const handleDisconnectAllSessions = async () => {
    setIsDisconnecting(true);
    await disconnectAllSessions(publicKey, network);

    // Add a small delay for smooth UX
    setTimeout(() => {
      setIsDisconnecting(false);
    }, VISUAL_DELAY_MS);
  };

  if (showScanner) {
    return (
      <View className="flex-1">
        <View className="flex-row items-center w-full">
          <TouchableOpacity onPress={() => setShowScanner(false)}>
            <Icon.ArrowLeft color={themeColors.base[1]} />
          </TouchableOpacity>
        </View>

        <View className="flex-1 pt-10 items-center">
          <QRScanner onRead={handleOnRead} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between w-full">
        <TouchableOpacity onPress={onDismiss}>
          <Icon.X color={themeColors.base[1]} />
        </TouchableOpacity>

        <Text md primary semiBold>
          {t("connectedApps.title")}
        </Text>

        {/* Adding this duplicate hidden icon here to help with title alignment */}
        <Icon.X color="transparent" />
      </View>

      <View className="w-full mt-6 gap-4">
        <Input
          placeholder={t("connectedApps.inputPlaceholder")}
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
          {t("connectedApps.scanQRCode")}
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
          {t("connectedApps.connect")}
        </Button>
      </View>

      <View className="mt-10 mb-4">
        <Text md primary semiBold>
          {t("connectedApps.connectedDapps")}
        </Text>
      </View>

      <BottomSheetScrollView
        className="w-full"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        contentContainerStyle={{
          gap: pxValue(16),
          paddingBottom: pxValue(64),
        }}
      >
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
              {t("connectedApps.disconnectAllSessions")}
            </Button>
          </>
        ) : (
          <Text sm secondary>
            {t("connectedApps.noConnectedDapps")}
          </Text>
        )}
      </BottomSheetScrollView>
    </View>
  );
};

export const ConnectedAppsBottomSheet: React.FC<
  ConnectedAppsBottomSheetProps
> = ({ modalRef, onDismiss }) => (
  <BottomSheet
    snapPoints={["80%"]}
    modalRef={modalRef}
    enableDynamicSizing={false}
    useInsetsBottomPadding={false}
    customContent={<ConnectedAppsCustomContent onDismiss={onDismiss} />}
  />
);
