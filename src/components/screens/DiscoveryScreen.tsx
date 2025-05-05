import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { QRScanner } from "components/QRScanner";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Display } from "components/sds/Typography";
import { MainTabStackParamList, MAIN_TAB_ROUTES } from "config/routes";
import {
  useWalletKitStore,
  WalletKitEventTypes,
  StellarRpcChains,
  StellarRpcMethods,
  WalletKitEvent,
} from "ducks/walletKit";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";

const testConnectionEvent: WalletKitEvent = {
  type: WalletKitEventTypes.SESSION_PROPOSAL,
  id: "1745937011044777",
  params: {
    id: "1745937011044777",
    pairingTopic:
      "54eb7368e59020328c26770ea8188aabb47661e876367972305217941cd708d6",
    expiryTimestamp: 1745937311,
    requiredNamespaces: {
      stellar: {
        methods: [StellarRpcMethods.SIGN_XDR],
        chains: [StellarRpcChains.PUBLIC],
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
      publicKey:
        "da4cd18968e3076fe5bc76435f5875150adf266691d27c50f41ae1c6b5fa3e3a",
      metadata: {
        name: "FxDAO",
        url: "https://fxdao.io",
        description:
          "A decentralized borrowing protocol for the issuance of decentralized stablecoins on Stellar",
        icons: ["https://assets.fxdao.io/brand/FxDAO-logo.svg"],
      },
    },
    // "proposer": {
    //   "publicKey": "1efa67fac268b7c47763ac9f08b1ac227f4d05dcd49c1880a8108aec29d46c4d",
    //   "metadata": {
    //     "name": "Blend Mainnet",
    //     "url": "https://mainnet.blend.capital",
    //     "description": "Blend is a liquidity protocol primitive, enabling the creation of money markets for any use case.",
    //     "icons": [
    //       "https://docs.blend.capital/~gitbook/image?url=https%3A%2F%2F3627113658-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FlsteMPgIzWJ2y9ruiTJy%252Fuploads%252FVsvCoCALpHWAw8LpU12e%252FBlend%2520Logo%25403x.png%3Falt%3Dmedia%26token%3De8c06118-43b7-4ddd-9580-6c0fc47ce971&width=768&dpr=2&quality=100&sign=f4bb7bc2&sv=1"
    //     ]
    //   }
    // }
    // "proposer": {
    //   "publicKey": "aecdb2f68156955fd3e8a480a8d43bdda1d97ac9e7896c2fdb6d25d3b84c2a01",
    //   "metadata": {
    //     "description": "Buy, sell, and trade any token on the Stellar network in seconds just by connecting your wallet.",
    //     "url": "https://www.stellarx.com",
    //     "icons": [
    //       "https://www.stellarx.com/images/favicon.png",
    //       "https://www.stellarx.com/images/ios/touch-icon.png"
    //     ],
    //     "name": "StellarX — DEX trading platform with AMM access"
    //   }
    // }
    // "proposer": {
    //   "publicKey": "c11b737a9f67e9f6dc7e8ae34a22eefc413e8baa62c770ce09570acd1a2dd265",
    //   "metadata": {
    //     "name": "Aquarius",
    //     "description": "Aquarius - liquidity management layer for Stellar",
    //     "url": "https://aqua.network",
    //     "icons": [
    //       "https://aqua.network/favicon.png"
    //     ]
    //   }
    // }
    // "proposer": {
    //   "publicKey": "0e662f9b94c0fb2ac3d2ef1df851375db2c3726ddf977eaffd74a6241cbfff6d",
    //   "metadata": {
    //     "name": "StellarTerm",
    //     "description": "StellarTerm is an advanced web-based trading client for the Stellar network. Send, receive, and trade assets on the Stellar network easily with StellarTerm.",
    //     "url": "https://stellarterm.com",
    //     "icons": [
    //       "https://avatars.githubusercontent.com/u/25021964?s=200&v=4.png"
    //     ]
    //   }
    // }
    // "proposer": {
    //   "publicKey": "1e5965c16b9fcf5120cd99f072cfeb1ca44ae8b0d16ee518e05436d07d45653a",
    //   "metadata": {
    //     "name": "Phoenix DeFi Hub",
    //     "url": "https://app.phoenix-hub.io",
    //     "description": "Serving only the tastiest DeFi",
    //     "icons": [
    //       "https://app.phoenix-hub.io/logoIcon.png"
    //     ]
    //   }
    // }
  },
  verifyContext: {
    verified: {
      verifyUrl: "https://verify.walletconnect.org",
      validation: "UNKNOWN",
      origin: "https://fxdao.io",
    },
  },
};

const testRequestEvent: WalletKitEvent = {
  type: WalletKitEventTypes.SESSION_REQUEST,
  id: "1745937011044777",
  topic: "2436baceea330e480b05c3317d4a2a1b73c06f0ddb2e948821834ba4ffd9c0d2",
  params: {
    request: {
      method: StellarRpcMethods.SIGN_XDR,
      params: {
        // origin: "https://www.stellarx.com",
        xdr: "AAAAAgAAAABiYAd0QKmkoRw9vfUCblDMI1urU8xQOdBftbIfhMGjpgABhqADYYJ6AAAAHQAAAAEAAAAAAAAAAAAAAABoOwYkAAAAAAAAAAEAAAAAAAAADQAAAAAAAAAAALxLIAAAAABiYAd0QKmkoRw9vfUCblDMI1urU8xQOdBftbIfhMGjpgAAAAFVU0RDAAAAADuZETgO/piLoKiQDrHP5E82b32+lGvtB3JA9/Yk3xXFAAAAAAAxv+oAAAAAAAAAAAAAAAA=",

        // origin: "https://aqua.network"
        // xdr: "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",

        // origin: "https://fxdao.io"
        // xdr: "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",

        // origin: "https://mainnet.blend.capital"
        // xdr: "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",

        // origin: "https://stellarterm.com"
        // xdr: "AAAAAgAAAABiYAd0QKmkoRw9vfUCblDMI1urU8xQOdBftbIfhMGjpgABhqADYYJ6AAAAHQAAAAEAAAAAAAAAAAAAAABoOwrnAAAAAAAAAAEAAAAAAAAADAAAAAFVU0R4AAAAACp+5sAQMaed9DcKvaznSjCDuK+SKGZpR1a6JNrnBX0FAAAAAAAAAAAtkHa/ABjzawBMS0AAAAAAAAAAAAAAAAAAAAAA",
      },
      expiryTimestamp: 1746106960,
    },
    chainId: StellarRpcChains.PUBLIC,
  },
  verifyContext: {
    verified: {
      verifyUrl: "https://verify.walletconnect.org",
      validation: "UNKNOWN",
      origin: "https://www.stellarx.com",
    },
  },
};

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getClipboardText } = useClipboard();

  const [uri, setUri] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState("");

  const handleClearUri = () => {
    setUri("");
    setError("");
  };

  const handlePasteFromClipboard = () => {
    getClipboardText().then(setUri);
  };

  const handleOnRead = (data: string) => {
    setUri(data);
    setShowScanner(false);
  };

  const handleConnect = () => {
    setError("Error connecting to wallet");
  };

  if (showScanner) {
    return (
      <BaseLayout insets={{ bottom: false }}>
        <TouchableOpacity
          onPress={() => setShowScanner(false)}
          className="w-10 h-10 mb-2 flex items-center justify-center"
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

      <View className="flex-1 mt-4 gap-4">
        <Input
          placeholder="Enter WalletConnect URI"
          fieldSize="lg"
          value={uri}
          onChangeText={setUri}
          error={error}
          leftElement={
            <Icon.Link04 size={16} color={themeColors.foreground.primary} />
          }
          rightElement={
            <TouchableOpacity
              className="p-3 ml-1 mr-1"
              onPress={handleClearUri}
            >
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
          Scan QR Code
        </Button>

        <Button
          lg
          onPress={handleConnect}
          primary
          icon={
            <Icon.Link04
              color={
                uri.length === 0
                  ? themeColors.text.secondary
                  : themeColors.text.primary
              }
            />
          }
          iconPosition={IconPosition.LEFT}
          disabled={uri.length === 0}
        >
          Connect
        </Button>
      </View>

      <Button
        primary
        onPress={() => {
          useWalletKitStore.getState().setEvent(testConnectionEvent);
        }}
      >
        Display Dapp Connection Modal
      </Button>

      <View className="h-10" />

      <Button
        secondary
        onPress={() => {
          useWalletKitStore.getState().setEvent(testRequestEvent);
        }}
      >
        Display Dapp Request Modal
      </Button>

      <View className="h-10" />
    </BaseLayout>
  );
};
