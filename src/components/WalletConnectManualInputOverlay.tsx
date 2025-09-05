import { logos } from "assets/logos";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View, Image, TouchableOpacity } from "react-native";

/**
 * Props for the WalletConnectManualInputOverlay component
 */
interface WalletConnectManualInputOverlayProps {
  manualInput: string;
  onManualInputChange: (text: string) => void;
  onConnect: () => void;
  onClearInput: () => void;
  onPasteFromClipboard: () => void;
  isConnecting: boolean;
  error: string;
  themeColors: {
    text: {
      primary: string;
      secondary: string;
    };
    background: {
      secondary: string;
    };
  };
  t: ReturnType<typeof useAppTranslation>["t"];
}

/**
 * Component for rendering the manual input overlay (WalletConnect specific)
 *
 * This component provides a manual input interface for WalletConnect URIs
 * with WalletConnect branding and input controls.
 */
export const WalletConnectManualInputOverlay: React.FC<
  WalletConnectManualInputOverlayProps
> = ({
  manualInput,
  onManualInputChange,
  onConnect,
  onClearInput,
  onPasteFromClipboard,
  isConnecting,
  error,
  themeColors,
  t,
}) => (
  <View className="flex-1 justify-end z-[100]">
    <View className="bg-background-tertiary rounded-2xl py-4 px-5 gap-3 pointer-events-auto">
      <View className="flex-row items-center">
        <View className="w-6 h-6 rounded-full overflow-hidden mr-2 justify-center items-center">
          <Image
            source={logos.walletConnect}
            resizeMode="contain"
            style={{ width: "100%", height: "100%" }}
          />
        </View>
        <Text sm secondary medium>
          {t("walletConnect.connectWithWalletConnect")}
        </Text>
      </View>

      <Input
        editable={false}
        placeholder={t("walletConnect.inputPlaceholder")}
        value={manualInput}
        onChangeText={onManualInputChange}
        error={error}
        rightElement={
          <TouchableOpacity className="p-3 mr-1" onPress={onClearInput}>
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
          onPress: onPasteFromClipboard,
          disabled: isConnecting,
          color: isConnecting
            ? themeColors.text.secondary
            : themeColors.text.primary,
          backgroundColor: themeColors.background.secondary,
        }}
      />

      <Button
        isLoading={isConnecting}
        disabled={isConnecting || !manualInput.trim()}
        lg
        tertiary
        onPress={onConnect}
      >
        {t("walletConnect.connect")}
      </Button>
    </View>
  </View>
);
