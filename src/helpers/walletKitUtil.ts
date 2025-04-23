import {WalletKit, IWalletKit} from '@reown/walletkit';
import {Core} from '@walletconnect/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from 'config/logger';

const PROJECT_ID = "ab11883e1469411a76f578a274f3dce0";

const metadata = {
  name: "Freighter Test React Native Wallet",
  description: "Freighter Test RN Wallet to interface with Dapps",
  url: "https://freighter.app",
  icons: ["https://lh3.googleusercontent.com/_IWkBPJYpuslJcxNCIxeoJqmKJ8WOek43XeEsE_EiDrMzawR31KTAVweF-oyGVKJjW9kbDkxByD6mpYoV7H8uGQA=s60"],
  // TODO: should we avoid setting redirect when using QR code?
  redirect: {
    // TODO: implement deep link
    native: "freighterwallet://test-link",
  },
};

export let walletKit: IWalletKit;

export async function createWalletKit() {
  const core = new Core({
    projectId: PROJECT_ID,
  });
  walletKit = await WalletKit.init({
    core,
    metadata,
  });

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
