import Clipboard from "@react-native-clipboard/clipboard";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { isE2ETest } from "helpers/isEnv";
import { useToast } from "providers/ToastProvider";
import React, {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { View, TouchableOpacity, ScrollView, Modal } from "react-native";

/**
 * FAB Trigger for WalletConnect E2E Helper
 */
export const WalletConnectE2EHelperTrigger: React.FC<{
  onPress: () => void;
}> = ({ onPress }) => {
  if (!isE2ETest) {
    return null;
  }

  return (
    <TouchableOpacity
      testID="wc-e2e-helper-fab"
      onPress={onPress}
      style={{
        position: "absolute",
        bottom: 80,
        right: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#9333ea",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 9999,
      }}
    >
      <Icon.Settings01 size={24} color="white" />
    </TouchableOpacity>
  );
};

interface WalletConnectE2EHelperRef {
  present: () => void;
  dismiss: () => void;
}

export type { WalletConnectE2EHelperRef };

/**
 * WalletConnect E2E Helper Modal
 * Uses Modal instead of BottomSheet for Maestro accessibility
 */
export const WalletConnectE2EHelper = forwardRef<WalletConnectE2EHelperRef>(
  (_, ref) => {
    const [visible, setVisible] = useState(false);
    const [sessionId, setSessionId] = useState("");
    const [wcUri, setWcUri] = useState("");
    const [message, setMessage] = useState("");
    const [network, setNetwork] = useState("pubnet");
    const [status, setStatus] = useState("");
    const baseUrl = "http://127.0.0.1:3001";
    const { showToast } = useToast();

    const handleDismiss = useCallback(() => {
      setVisible(false);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        present: () => setVisible(true),
        dismiss: handleDismiss,
      }),
      [handleDismiss],
    );

    const createSession = async () => {
      try {
        setStatus("Creating session...");
        const res = await fetch(`${baseUrl}/session/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const errorMsg = `Error: ${res.status} ${res.statusText}`;
          setStatus(errorMsg);
          showToast({
            title: "Session Creation Failed",
            message: errorMsg,
            variant: "error",
          });
          return;
        }
        const data = await res.json();
        const sessionData = data as { sessionId: string; uri: string };
        setSessionId(sessionData.sessionId);
        setWcUri(sessionData.uri);
        setStatus("Session created!");
      } catch (error) {
        const isNetworkError =
          error instanceof TypeError &&
          (error.message.includes("Network request failed") ||
            error.message.includes("fetch"));

        const errorMsg = isNetworkError
          ? "Mock server is offline. Please start it with: cd mock-dapp && npm start"
          : `Error: ${error instanceof Error ? error.message : String(error)}`;

        setStatus(errorMsg);
        showToast({
          title: "Server Offline",
          message: isNetworkError
            ? "Mock dApp server is not running. Start it with 'npm start' in mock-dapp folder."
            : errorMsg,
          variant: "error",
        });
      }
    };

    const copyWcUri = () => {
      Clipboard.setString(wcUri);
      setStatus("WC URI copied to clipboard!");
      // Auto-dismiss modal after copying
      setTimeout(() => handleDismiss(), 500);
    };

    const requestSignMessage = async () => {
      if (!sessionId) {
        setStatus("Error: No session ID");
        showToast({
          title: "No Session",
          message: "Create a session first",
          variant: "error",
        });
        return;
      }
      try {
        setStatus("Requesting sign message...");
        const res = await fetch(
          `${baseUrl}/session/${sessionId}/request/signMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, network }),
          },
        );
        if (!res.ok) {
          const errorMsg = `Error: ${res.status} ${res.statusText}`;
          setStatus(errorMsg);
          showToast({
            title: "Request Failed",
            message: errorMsg,
            variant: "error",
          });
          return;
        }
        setStatus("Sign message request sent!");
        // Auto-dismiss modal after requesting sign
        setTimeout(() => handleDismiss(), 500);
      } catch (error) {
        const isNetworkError =
          error instanceof TypeError &&
          (error.message.includes("Network request failed") ||
            error.message.includes("fetch"));

        const errorMsg = isNetworkError
          ? "Mock server is offline"
          : `Error: ${error instanceof Error ? error.message : String(error)}`;

        setStatus(errorMsg);
        showToast({
          title: "Server Offline",
          message: isNetworkError
            ? "Mock dApp server is not running"
            : errorMsg,
          variant: "error",
        });
      }
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleDismiss}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "black",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxHeight: "80%",
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "bold" }}>
                WC E2E Helper
              </Text>
              <TouchableOpacity
                testID="wc-e2e-close-modal"
                onPress={handleDismiss}
              >
                <Icon.X size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              {/* Create Session */}
              <View style={{ marginBottom: 16 }}>
                <Button
                  testID="wc-e2e-create-session"
                  onPress={createSession}
                  size="sm"
                >
                  Create Session
                </Button>
              </View>

              {/* Session Info */}
              {sessionId && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 8 }}>
                    Session ID:
                  </Text>
                  <Text
                    testID="wc-e2e-session-id"
                    style={{ fontSize: 12, marginBottom: 8 }}
                  >
                    {sessionId}
                  </Text>

                  <Text style={{ fontWeight: "600", marginBottom: 8 }}>
                    WC URI:
                  </Text>
                  <Text
                    testID="wc-e2e-wc-uri"
                    style={{ fontSize: 12, marginBottom: 8 }}
                    numberOfLines={3}
                  >
                    {wcUri.substring(0, 100)}...
                  </Text>

                  <Button
                    testID="wc-e2e-copy-uri"
                    onPress={copyWcUri}
                    size="sm"
                    variant="secondary"
                  >
                    Copy WC URI
                  </Button>
                </View>
              )}

              {/* Request Sign Message */}
              {sessionId && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 8 }}>
                    Request Sign:
                  </Text>

                  <Input
                    testID="wc-e2e-message-input"
                    placeholder="Message to sign"
                    value={message}
                    onChangeText={setMessage}
                    style={{ marginBottom: 8 }}
                  />

                  <Input
                    testID="wc-e2e-network-input"
                    placeholder="Network (testnet/pubnet)"
                    value={network}
                    onChangeText={setNetwork}
                    style={{ marginBottom: 8 }}
                  />

                  <Button
                    testID="wc-e2e-request-sign"
                    onPress={requestSignMessage}
                    size="sm"
                  >
                    Request Sign Message
                  </Button>
                </View>
              )}

              {/* Status */}
              {status && (
                <View
                  style={{
                    padding: 12,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 8,
                  }}
                >
                  <Text testID="wc-e2e-status" style={{ fontSize: 14 }}>
                    {status}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  },
);
