/**
 * WCE2ES – WalletConnect E2E Simulator
 *
 * Only rendered when IS_E2E_TEST=true.
 * Small FAB on the bottom-left (mirrors the debug trigger on the right).
 * Tapping the FAB expands a compact menu with WalletConnect test actions
 * that inject mock SESSION_REQUEST events directly into the store.
 */
import {
  useWalletKitStore,
  WalletKitEventTypes,
  StellarRpcMethods,
  StellarRpcChains,
} from "ducks/walletKit";
import { isE2ETest } from "helpers/isEnv";
import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";

const MOCK_TOPIC = `e2e-test-topic-${Date.now()}`;

export const WCE2ES: React.FC = () => {
  const { setEvent } = useWalletKitStore();
  const [expanded, setExpanded] = useState(false);

  if (!isE2ETest) {
    return null;
  }

  const createEvent = (method: string, params: Record<string, unknown>) => {
    setEvent({
      type: WalletKitEventTypes.SESSION_REQUEST,
      id: Date.now(),
      topic: MOCK_TOPIC,
      params: {
        request: { method, params },
        chainId: StellarRpcChains.TESTNET,
      },
      verifyContext: {
        verified: {
          origin: "http://localhost:3001",
          validation: "VALID",
          verifyUrl: "",
          isScam: false,
        },
      },
    });
  };

  const handleSignMessage = () => {
    createEvent(StellarRpcMethods.SIGN_MESSAGE, {
      message: "Hello, Stellar! This is an E2E test message.",
    });
    setExpanded(false);
  };

  const handleSignMessageJSON = () => {
    createEvent(StellarRpcMethods.SIGN_MESSAGE, {
      message: JSON.stringify({
        action: "transfer",
        amount: "100",
        recipient: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      }),
    });
    setExpanded(false);
  };

  const handleAddTrustline = () => {
    createEvent(StellarRpcMethods.SIGN_XDR, {
      xdr: "AAAAAgAAAABi/B0L0JGythwN1lY0aypo19NHxvLCyO5tBEc/hU+rZwAAAGQAB14lAAAA0QAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAABAAAAAAAAAAYAAAABVVNEQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB9f/IA=",
    });
    setExpanded(false);
  };

  return (
    <View
      className="absolute bottom-4 left-4 z-50 items-center"
      testID="e2e-wc-simulator"
    >
      {expanded && (
        <View className="mb-2 bg-black/95 rounded-3xl py-1.5 px-2 gap-1">
          <Text className="text-white/50 text-xs font-bold text-center tracking-wider mb-0.5">
            WCE2ES
          </Text>
          <TouchableOpacity
            className="flex-row items-center py-2 px-2.5 rounded-2xl bg-purple-500/30"
            onPress={handleSignMessage}
            testID="e2e-trigger-sign-message"
          >
            <Text className="text-white text-sm font-semibold">Sign Msg</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center py-2 px-2.5 rounded-2xl bg-purple-500/30"
            onPress={handleSignMessageJSON}
            testID="e2e-trigger-sign-message-json"
          >
            <Text className="text-white text-sm font-semibold">Sign JSON</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center py-2 px-2.5 rounded-2xl bg-purple-500/30"
            onPress={handleAddTrustline}
            testID="e2e-trigger-add-trustline"
          >
            <Text className="text-white text-sm font-semibold">Trustline</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        className="w-12 h-12 rounded-full bg-purple-600/90 items-center justify-center border border-white/20"
        onPress={() => setExpanded((prev) => !prev)}
        testID="e2e-wc-fab"
      >
        <Text className="text-white text-base font-bold">
          {expanded ? "X" : "WC"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
