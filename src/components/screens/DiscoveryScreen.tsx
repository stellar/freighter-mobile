import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Input } from "../sds/Input";
import { Button, IconPosition } from "../sds/Button";
import { Display } from "../sds/Typography";
import { pxValue } from "../../helpers/dimensions";
import { walletKit } from "../../helpers/walletKitUtil";
import { logger } from "config/logger";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import Clipboard from "@react-native-clipboard/clipboard";
import { QRScanner } from "../QRScanner";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: pxValue(16),
  },
  title: {
    alignSelf: "center",
    marginBottom: pxValue(24),
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: pxValue(16),
  },
});

export const DiscoveryScreen = () => {
  const { t } = useTranslation();
  const [uri, setUri] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const handlePair = async () => {
    if (!uri) {
      setError("Please enter a valid URI");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await walletKit.pair({ uri });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pair");
      logger.error("WalletKit", "error pairing", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setUri("");
    setError("");
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await Clipboard.getString();
      setUri(clipboardText);
      setError("");
    } catch (err) {
      logger.error("DiscoveryScreen", "error pasting from clipboard", err);
    }
  };

  const handleScan = (data: string) => {
    logger.debug("DiscoveryScreen", "QR code scanned", { data });
    setUri(data);
    setShowScanner(false);
  };

  if (showScanner) {
    return <QRScanner onRead={handleScan} onClose={() => setShowScanner(false)} />;
  }

  return (
    <BaseLayout insets={{ bottom: false }}>
      <Display sm style={styles.title}>
        {t("discovery.title")}
      </Display>
      
      <View style={{ height: pxValue(40) }} />

      <Input
        placeholder="Enter WalletConnect URI"
        value={uri}
        onChangeText={setUri}
        error={error}
      />

      <View style={{ height: pxValue(40) }} />
      
      <Button
        onPress={handlePair}
        isLoading={loading}
        primary
        lg
      >
        Connect
      </Button>

      <View style={styles.buttonRow}>
        <Button
          onPress={handleClear}
          secondary
          icon={<Icon.X />}
          iconPosition={IconPosition.LEFT}
        >
          Clear
        </Button>
        <Button
          onPress={handlePaste}
          secondary
          icon={<Icon.Clipboard />}
          iconPosition={IconPosition.LEFT}
        >
          Paste from Clipboard
        </Button>
      </View>

      <View style={{ height: pxValue(40) }} />
      
      <Button
          onPress={() => setShowScanner(true)}
          secondary
          icon={<Icon.Camera01 />}
          iconPosition={IconPosition.LEFT}
        >
          Scan QR Code
        </Button>
    </BaseLayout>
  );
};
