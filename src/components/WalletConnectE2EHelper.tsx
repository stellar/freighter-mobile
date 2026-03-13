import Clipboard from "@react-native-clipboard/clipboard";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { isAndroid } from "helpers/device";
import { isE2ETest } from "helpers/isEnv";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import React, {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useRef,
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
/**
 * Helper function to make fetch requests with timeout protection
 * @param url The URL to fetch
 * @param options Fetch options
 * @param timeoutMs Timeout in milliseconds (default: 10000)
 * @returns Promise<Response>
 */
const fetchWithTimeout = (
  url: string,
  options?: RequestInit,
  timeoutMs: number = 10000,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
};

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
    const { t } = useAppTranslation();
    const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

    useEffect(
      () => () => {
        if (dismissTimeoutRef.current) {
          clearTimeout(dismissTimeoutRef.current);
        }
      },
      [],
    );

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
        const res = await fetchWithTimeout(`${baseUrl}/session/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const errorMsg = `Error: ${res.status} ${res.statusText}`;
          setStatus(errorMsg);
          showToast({
            title: t("walletKit.e2eHelper.createSessionFailed"),
            message: errorMsg,
            variant: "error",
          });
          return;
        }
        const data = await res.json();
        // Validate response structure
        if (
          !data ||
          typeof data !== "object" ||
          !("sessionId" in data) ||
          !("uri" in data)
        ) {
          const errorMsg = "Invalid response: missing sessionId or uri";
          setStatus(errorMsg);
          showToast({
            title: t("walletKit.e2eHelper.createSessionFailed"),
            message: errorMsg,
            variant: "error",
          });
          return;
        }
        const sessionData = data as { sessionId: string; uri: string };
        setSessionId(sessionData.sessionId);
        setWcUri(sessionData.uri);
        setStatus(t("walletKit.e2eHelper.sessionCreated"));
      } catch (error) {
        let isNetworkError = false;
        let errorMsg = "";

        if (error instanceof TypeError) {
          isNetworkError =
            error.message.includes("Network request failed") ||
            error.message.includes("fetch") ||
            error.message.includes("timeout") ||
            error.name === "AbortError";
        }

        if (isNetworkError) {
          errorMsg = t("walletKit.e2eHelper.mockServerOfflineStatus");
        } else if (error instanceof Error) {
          errorMsg = error.message;
        } else {
          errorMsg = String(error);
        }

        setStatus(errorMsg);
        showToast({
          title: t("walletKit.e2eHelper.serverOffline"),
          message: isNetworkError
            ? t("walletKit.e2eHelper.mockServerNotRunningLong")
            : errorMsg,
          variant: "error",
        });
      }
    };

    const copyWcUri = () => {
      Clipboard.setString(wcUri);
      setStatus(t("walletKit.e2eHelper.wcUriCopied"));
      // Auto-dismiss modal after copying
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
      dismissTimeoutRef.current = setTimeout(() => handleDismiss(), 500);
    };

    const requestSignMessage = async () => {
      if (!sessionId) {
        setStatus(t("walletKit.e2eHelper.noSession"));
        showToast({
          title: t("walletKit.e2eHelper.noSession"),
          message: t("walletKit.e2eHelper.noSessionMessage"),
          variant: "error",
        });
        return;
      }
      try {
        setStatus(t("walletKit.e2eHelper.signingMessage"));
        const res = await fetchWithTimeout(
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
            title: t("walletKit.e2eHelper.requestFailed"),
            message: errorMsg,
            variant: "error",
          });
          return;
        }
        // Validate JSON response
        try {
          await res.json();
        } catch {
          const errorMsg = "Invalid response: non-JSON data received";
          setStatus(errorMsg);
          showToast({
            title: t("walletKit.e2eHelper.requestFailed"),
            message: errorMsg,
            variant: "error",
          });
          return;
        }
        setStatus(t("walletKit.e2eHelper.signingMessage"));
        // Android: dismiss immediately so @gorhom/bottom-sheet can appear — a live
        // React Native Modal blocks it on Android, so we must close before the WC
        // event arrives. iOS: small delay to let the modal fade-out animation finish
        // before the bottom sheet presents, avoiding a UIKit animation race condition.
        if (dismissTimeoutRef.current) {
          clearTimeout(dismissTimeoutRef.current);
        }
        if (isAndroid) {
          handleDismiss();
        } else {
          dismissTimeoutRef.current = setTimeout(() => handleDismiss(), 350);
        }
      } catch (error) {
        let isNetworkError = false;
        let errorMsg = "";

        if (error instanceof TypeError) {
          isNetworkError =
            error.message.includes("Network request failed") ||
            error.message.includes("fetch") ||
            error.message.includes("timeout") ||
            error.name === "AbortError";
        }

        if (isNetworkError) {
          errorMsg = t("walletKit.e2eHelper.mockServerNotRunning");
        } else if (error instanceof Error) {
          errorMsg = error.message;
        } else {
          errorMsg = String(error);
        }

        setStatus(errorMsg);
        showToast({
          title: t("walletKit.e2eHelper.serverOffline"),
          message: isNetworkError
            ? t("walletKit.e2eHelper.mockServerNotRunning")
            : errorMsg,
          variant: "error",
        });
      }
    };

    const requestSignAuthEntry = async () => {
      if (!sessionId) {
        setStatus(t("walletKit.e2eHelper.noSession"));
        showToast({
          title: t("walletKit.e2eHelper.noSession"),
          message: t("walletKit.e2eHelper.noSessionMessage"),
          variant: "error",
        });
        return;
      }
      try {
        setStatus(t("walletKit.e2eHelper.signingAuthEntry"));
        const res = await fetchWithTimeout(
          `${baseUrl}/session/${sessionId}/request/signAuthEntry`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ network }),
          },
        );
        if (!res.ok) {
          const errorMsg = `Error: ${res.status} ${res.statusText}`;
          setStatus(errorMsg);
          showToast({
            title: t("walletKit.e2eHelper.requestFailed"),
            message: errorMsg,
            variant: "error",
          });
          return;
        }
        // Validate JSON response
        try {
          await res.json();
        } catch {
          const errorMsg = "Invalid response: non-JSON data received";
          setStatus(errorMsg);
          showToast({
            title: t("walletKit.e2eHelper.requestFailed"),
            message: errorMsg,
            variant: "error",
          });
          return;
        }
        setStatus(t("walletKit.e2eHelper.signingAuthEntry"));
        // Dismiss immediately on both platforms. For signAuthEntry the WC relay
        // round-trip is fast enough that delaying the dismiss (as we do for
        // signMessage) causes the WC session_request event to arrive BEFORE the
        // modal is closed, blocking @gorhom/bottom-sheet from presenting on iOS.
        // Immediate dismiss starts the ~300 ms fade-out animation; by the time the
        // WC event completes the relay round-trip the animation is already done.
        if (dismissTimeoutRef.current) {
          clearTimeout(dismissTimeoutRef.current);
        }
        handleDismiss();
      } catch (error) {
        let isNetworkError = false;
        let errorMsg = "";

        if (error instanceof TypeError) {
          isNetworkError =
            error.message.includes("Network request failed") ||
            error.message.includes("fetch") ||
            error.message.includes("timeout") ||
            error.name === "AbortError";
        }

        if (isNetworkError) {
          errorMsg = t("walletKit.e2eHelper.mockServerNotRunning");
        } else if (error instanceof Error) {
          errorMsg = error.message;
        } else {
          errorMsg = String(error);
        }

        setStatus(errorMsg);
        showToast({
          title: t("walletKit.e2eHelper.serverOffline"),
          message: isNetworkError
            ? t("walletKit.e2eHelper.mockServerNotRunning")
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
                {t("walletKit.e2eHelper.title")}
              </Text>
              <TouchableOpacity
                testID="wc-e2e-close-modal"
                onPress={handleDismiss}
              >
                <Icon.X size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 500 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Create Session */}
              <View style={{ marginBottom: 16 }}>
                <Button
                  testID="wc-e2e-create-session"
                  onPress={createSession}
                  size="sm"
                >
                  {t("walletKit.e2eHelper.createSession")}
                </Button>
              </View>

              {/* Session Info */}
              {sessionId && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 8 }}>
                    {t("walletKit.e2eHelper.sessionId")}:
                  </Text>
                  <Text
                    testID="wc-e2e-session-id"
                    style={{ fontSize: 12, marginBottom: 8 }}
                  >
                    {sessionId}
                  </Text>

                  <Text style={{ fontWeight: "600", marginBottom: 8 }}>
                    {t("walletKit.e2eHelper.wcUri")}:
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
                    {t("walletKit.e2eHelper.copyWcUri")}
                  </Button>
                </View>
              )}

              {sessionId && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 8 }}>
                    {t("walletKit.e2eHelper.requestSignAuthEntry")}:
                  </Text>

                  <Button
                    testID="wc-e2e-request-sign-auth-entry"
                    onPress={requestSignAuthEntry}
                    size="sm"
                  >
                    {t("walletKit.e2eHelper.requestSignAuthEntry")}
                  </Button>
                </View>
              )}

              {/* Request Sign Message */}
              {sessionId && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 8 }}>
                    {t("walletKit.e2eHelper.requestSignMessage")}:
                  </Text>

                  <Input
                    testID="wc-e2e-message-input"
                    placeholder={t("walletKit.e2eHelper.message")}
                    value={message}
                    onChangeText={setMessage}
                    style={{ marginBottom: 8 }}
                  />

                  <Input
                    testID="wc-e2e-network-input"
                    placeholder={t("walletKit.e2eHelper.network")}
                    value={network}
                    onChangeText={setNetwork}
                    style={{ marginBottom: 8 }}
                  />

                  <Button
                    testID="wc-e2e-request-sign"
                    onPress={requestSignMessage}
                    size="sm"
                  >
                    {t("walletKit.e2eHelper.requestSignMessage")}
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
