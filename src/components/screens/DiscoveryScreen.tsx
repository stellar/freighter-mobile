import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display } from "components/sds/Typography";
import {
  useWalletKitStore,
  WalletKitEventTypes,
  StellarRpcChains,
  StellarRpcMethods,
  WalletKitEvent,
} from "ducks/walletKit";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

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
          useWalletKitStore.getState().setEvent(testConnectionEvent);
        }}
      >
        Display Dapp Connection Modal
      </Button>
    </BaseLayout>
  );
};
