import {WalletKit, IWalletKit} from '@reown/walletkit';
import {Core} from '@walletconnect/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from 'config/logger';
import { buildApprovedNamespaces, getSdkError, SdkErrorKey } from '@walletconnect/utils';

const PROJECT_ID = "ab11883e1469411a76f578a274f3dce0";

const metadata = {
  name: "Freighter Test React Native Wallet",
  description: "Freighter Test RN Wallet to interface with Dapps",
  url: "https://freighter.app",
  icons: ["https://lh3.googleusercontent.com/_IWkBPJYpuslJcxNCIxeoJqmKJ8WOek43XeEsE_EiDrMzawR31KTAVweF-oyGVKJjW9kbDkxByD6mpYoV7H8uGQA=s60"],
  redirect: {
    native: "freighterwallet://test-link",
  },
};

export let walletKit: IWalletKit;

export async function createWalletKit() {
  const core = new Core({
    projectId: PROJECT_ID,
  });

  logger.debug("createWalletKit", 'WalletConnect Core: ', core);

  walletKit = await WalletKit.init({
    core,
    metadata,
  });

  core.pairing.events.on("pairing_expire", async (event) => {
    // pairing expired before user approved/rejected a session proposal
    // const { topic } = event;
    logger.debug("createWalletKit", '> > > > > > > X X X X X X X X Pairing expired event: ', event);

    try {
      await walletKit.disconnectSession({
        topic: event.topic,
        reason: getSdkError("USER_DISCONNECTED"  as SdkErrorKey),
      });

      logger.debug("createWalletKit", '> > > > > > > X X X X X X X X Disconnected session: ', event.topic);
    } catch (error) {
      logger.error("createWalletKit", '> > > > > > > X X X X X X X X Error disconnecting session: ', error);
    }
  });

  core.relayer.on("relayer_connect", (event: any) => {
    // connection to the relay server is established
    logger.debug("createWalletKit", '> > > > > > > R R R R R R R R R Relay CCConnected: ', event);
  });

  core.relayer.on("relayer_disconnect", (event: any) => {
    // connection to the relay server is lost
    logger.debug("createWalletKit", '> > > > > > > R R R R R R R R R Relay DDDisconnected: ', event);
  });

  logger.debug("createWalletKit",'WalletConnect WalletKit: ', walletKit);

  try {
    const clientId =
      await walletKit.engine.signClient.core.crypto.getClientId();
    logger.debug('WalletConnect ClientID: ', clientId);
    // AsyncStorage.setItem('WALLETCONNECT_CLIENT_ID', clientId);
  } catch (error) {
    logger.error("createWalletKit",
      'Failed to set WalletConnect clientId in localStorage: ',
      error,
    );
  }
}

export async function updateSignClientChainId(
  chainId: string,
  address: string,
) {
  // get most recent session
  const sessions = walletKit.getActiveSessions();
  if (!sessions) {
    return;
  }
  const namespace = chainId.split(':')[0];
  Object.values(sessions).forEach(async session => {
    await walletKit.updateSession({
      topic: session.topic,
      namespaces: {
        ...session.namespaces,
        [namespace]: {
          ...session.namespaces[namespace],
          chains: [
            ...new Set(
              [chainId].concat(
                Array.from(session.namespaces[namespace].chains || []),
              ),
            ),
          ],
          accounts: [
            ...new Set(
              [`${chainId}:${address}`].concat(
                Array.from(session.namespaces[namespace].accounts),
              ),
            ),
          ],
        },
      },
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const chainChanged = {
      topic: session.topic,
      event: {
        name: 'chainChanged',
        data: parseInt(chainId.split(':')[1], 10),
      },
      chainId: chainId,
    };

    const accountsChanged = {
      topic: session.topic,
      event: {
        name: 'accountsChanged',
        data: [`${chainId}:${address}`],
      },
      chainId,
    };
    await walletKit.emitSessionEvent(chainChanged);
    await walletKit.emitSessionEvent(accountsChanged);
  });
}

