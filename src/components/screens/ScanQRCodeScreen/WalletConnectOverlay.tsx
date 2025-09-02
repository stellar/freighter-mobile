import { logos } from "assets/logos";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useCallback } from "react";
import { View, Image, TouchableOpacity } from "react-native";

interface WalletConnectOverlayProps {
  /** The current URI value */
  uri: string;
  /** Callback when URI changes */
  onUriChange: (uri: string) => void;
  /** Callback when connect button is pressed */
  onConnect: () => void;
  /** Whether the connection is in progress */
  isConnecting: boolean;
  /** Error message to display */
  error?: string;
}

/**
 * WalletConnectOverlay Component
 *
 * A overlay component that provides manual input functionality for WalletConnect URIs
 * on top of the QR scanner. It includes the WalletConnect branding and input controls.
 *
 * @param {WalletConnectOverlayProps} props - Component props
 * @returns {JSX.Element} The rendered overlay component
 */
export const WalletConnectOverlay: React.FC<WalletConnectOverlayProps> = ({
  uri,
  onUriChange,
  onConnect,
  isConnecting,
  error,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getClipboardText } = useClipboard();

  const handleClearUri = useCallback(() => {
    onUriChange("");
  }, [onUriChange]);

  const handlePasteFromClipboard = useCallback(() => {
    getClipboardText().then(onUriChange);
  }, [getClipboardText, onUriChange]);

  return (
    <View className="flex-1 justify-end z-[100]">
      <View className="bg-background-tertiary rounded-2xl py-4 px-5 gap-3">
        <View className="flex-row items-center">
          <View className="w-6 h-6 rounded-full overflow-hidden mr-2 justify-center items-center">
            <Image
              source={logos.walletConnect}
              resizeMode="contain"
              style={{ width: "100%", height: "100%" }}
            />
          </View>
          <Text sm secondary medium>
            {t("scanQRCodeScreen.connectWithWalletConnect")}
          </Text>
        </View>

        <Input
          editable={false}
          placeholder={t("scanQRCodeScreen.inputPlaceholder")}
          value={uri}
          onChangeText={onUriChange}
          error={error}
          rightElement={
            <TouchableOpacity className="p-3 mr-1" onPress={handleClearUri}>
              <Icon.X
                size={20}
                color={
                  isConnecting
                    ? themeColors.text.secondary
                    : themeColors.text.primary
                }
              />
            </TouchableOpacity>
          }
          endButton={{
            content: t("common.paste"),
            onPress: handlePasteFromClipboard,
            disabled: isConnecting,
            color: isConnecting
              ? themeColors.text.secondary
              : themeColors.text.primary,
            backgroundColor: themeColors.background.secondary,
          }}
        />

        <Button
          isLoading={isConnecting}
          disabled={isConnecting || !uri.trim()}
          lg
          tertiary
          onPress={onConnect}
        >
          {t("scanQRCodeScreen.connect")}
        </Button>
      </View>
    </View>
  );
};
