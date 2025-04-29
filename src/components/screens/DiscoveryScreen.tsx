import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display } from "components/sds/Typography";
import {
  useWalletKitStore,
  WalletKitEventTypes,
  StellarRpcChains,
  StellarRpcMethods,
} from "ducks/walletKit";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

export const DiscoveryScreen = () => {
  const { t } = useAppTranslation();

  return (
    <BaseLayout insets={{ bottom: false }}>
      <Display sm style={{ alignSelf: "center" }}>
        {t("discovery.title")}
      </Display>

      <View className="h-10" />

      <Button
        variant="primary"
        onPress={() => {
          useWalletKitStore.getState().setEvent({
            id: "test-id",
            type: WalletKitEventTypes.SESSION_PROPOSAL,
            params: {
              id: "test-id",
              pairingTopic: "test-pairing-topic",
              expiryTimestamp: Date.now() + 1000 * 60 * 60,
              requiredNamespaces: {
                stellar: {
                  chains: [StellarRpcChains.PUBNET],
                  methods: [StellarRpcMethods.SIGN_XDR],
                  events: [],
                },
              },
              optionalNamespaces: {},
              relays: [
                {
                  protocol: "irn",
                },
              ],
              proposer: {
                publicKey: "test-public-key",
                metadata: {
                  description: "Test dApp",
                  url: "https://test-dapp.com",
                  icons: ["https://test-dapp.com/icon.png"],
                  name: "Test dApp",
                },
              },
            },
            verifyContext: {
              verified: {
                verifyUrl: "https://test-dapp.com",
                validation: "test-validation",
                origin: "test-origin",
              },
            },
          });
        }}
      >
        Display Dapp Connection Modal
      </Button>
    </BaseLayout>
  );
};
