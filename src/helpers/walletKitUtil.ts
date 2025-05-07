import { WalletKit, IWalletKit } from "@reown/walletkit";
import {
  FeeBumpTransaction,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { Core } from "@walletconnect/core";
import {
  buildApprovedNamespaces,
  getSdkError,
  SdkErrorKey,
} from "@walletconnect/utils";
import { logger } from "config/logger";
import {
  ActiveSessions,
  StellarRpcChains,
  StellarRpcEvents,
  StellarRpcMethods,
  WALLET_KIT_METADATA,
  WALLET_KIT_PROJECT_ID,
  WalletKitSessionProposal,
  WalletKitSessionRequest,
} from "ducks/walletKit";
import { Linking } from "react-native";

const stellarNamespaceMethods = [
  StellarRpcMethods.SIGN_XDR,
  StellarRpcMethods.SIGN_AND_SUBMIT_XDR,
];
const stellarNamespaceChains = [
  StellarRpcChains.PUBLIC,
  StellarRpcChains.TESTNET,
];
const stellarNamespaceEvents = [StellarRpcEvents.ACCOUNT_CHANGED];

// eslint-disable-next-line import/no-mutable-exports
export let walletKit: IWalletKit;

export const createWalletKit = async () => {
  const core = new Core({
    projectId: WALLET_KIT_PROJECT_ID,
  });

  walletKit = await WalletKit.init({
    core,
    metadata: WALLET_KIT_METADATA,
  });
};

export const rejectSessionProposal = async ({
  sessionProposal,
}: {
  sessionProposal: WalletKitSessionProposal;
}) => {
  const { id } = sessionProposal;

  await walletKit.rejectSession({
    id,
    reason: getSdkError("USER_REJECTED" as SdkErrorKey),
  });
};

export const approveSessionProposal = async ({
  sessionProposal,
  activeAccounts,
}: {
  sessionProposal: WalletKitSessionProposal;
  activeAccounts: string[];
}) => {
  const { id, params } = sessionProposal;

  try {
    const approvedNamespaces = buildApprovedNamespaces({
      proposal: params,
      supportedNamespaces: {
        stellar: {
          methods: stellarNamespaceMethods,
          chains: stellarNamespaceChains,
          events: stellarNamespaceEvents,
          accounts: activeAccounts,
        },
      },
    });

    const session = await walletKit.approveSession({
      id,
      namespaces: approvedNamespaces,
    });

    const dappScheme = session.peer.metadata.redirect?.native;

    if (dappScheme) {
      // We should probably only open URL here if the session was initiated by a deep-link, in
      // which case it would make sense to redirect users back to the external dapp website.
      // In case the session was initiated by a QR code, we should show a toast/info-box letting
      // the user know that they can manually return to the DApp since they are probably handling
      // the dApp session in a desktop browser or another device.
      Linking.openURL(dappScheme);
    } else {
      // TODO: inform the user to manually return to the DApp
    }
  } catch (error) {
    // TODO: use the error.message to show toast/info-box letting the user know that the connection attempt failed
    logger.error("WalletKit", "onSessionProposal Error: ", error);
    rejectSessionProposal({ sessionProposal });
  }
};

export const rejectSessionRequest = async ({
  sessionRequest,
  message,
}: {
  sessionRequest: WalletKitSessionRequest;
  message: string;
}) => {
  const { id, topic } = sessionRequest;

  const response = {
    id,
    jsonrpc: "2.0",
    error: {
      code: 5000,
      message,
    },
  };

  await walletKit.respondSessionRequest({ topic, response });
};

export const approveSessionRequest = async ({
  sessionRequest,
  signTransaction,
  networkPassphrase,
  activeChain,
}: {
  sessionRequest: WalletKitSessionRequest;
  signTransaction: (
    transaction: Transaction | FeeBumpTransaction,
  ) => string | null;
  networkPassphrase: string;
  activeChain: string;
}) => {
  const { id, params, topic } = sessionRequest;
  const { request, chainId } = params || {};
  const { method, params: requestParams } = request || {};
  const { xdr } = requestParams || {};

  if (!stellarNamespaceMethods.includes(method as StellarRpcMethods)) {
    const message = `Invalid or unsupported namespace method: ${method}`;
    logger.error("WalletKit", message, { method });

    // TODO: show toast/info-box letting the user know that the request is invalid
    rejectSessionRequest({ sessionRequest, message });
    return;
  }

  if (chainId !== activeChain) {
    const message = `Invalid or unsupported namespace chain: ${chainId}, current active chain: ${activeChain}`;
    logger.error("WalletKit", message, { chainId, activeChain });

    // TODO: show toast/info-box letting the user know that the request is invalid
    rejectSessionRequest({ sessionRequest, message });
    return;
  }

  let signedTransaction;
  try {
    const transaction = TransactionBuilder.fromXDR(
      xdr as string,
      networkPassphrase,
    );
    signedTransaction = signTransaction(transaction);
  } catch (error) {
    const message = `Failed to sign transaction: ${error?.toString()}`;
    logger.error("WalletKit", "signTransaction Error: ", error);

    // TODO: show toast/info-box letting the user know that the request failed
    rejectSessionRequest({ sessionRequest, message });
    return;
  }

  const response = {
    id,
    result: { signedXDR: signedTransaction },
    jsonrpc: "2.0",
  };

  try {
    await walletKit.respondSessionRequest({ topic, response });
  } catch (error) {
    logger.error("WalletKit", "walletKit.respondSessionRequest Error: ", error);
    // TODO: show toast/info-box letting the user know that the request failed
  }
};

// eslint-disable-next-line @typescript-eslint/require-await
export const getActiveSessions = async () =>
  walletKit.getActiveSessions() as ActiveSessions;

export const disconnectAllSessions = async () => {
  const activeSessions = await getActiveSessions();

  await Promise.all(
    Object.values(activeSessions).map(async (activeSession) => {
      try {
        await walletKit.disconnectSession({
          topic: activeSession.topic,
          reason: getSdkError("USER_DISCONNECTED"),
        });
      } catch (_) {
        // noop
      }
    }),
  );
};
