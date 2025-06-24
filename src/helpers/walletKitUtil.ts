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
import { NETWORK_NAMES } from "config/constants";
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
import { TFunction } from "i18next";
import { ToastOptions } from "providers/ToastProvider";
import { Linking } from "react-native";

/** Supported Stellar RPC methods for WalletKit */
const stellarNamespaceMethods = [
  StellarRpcMethods.SIGN_XDR,
  StellarRpcMethods.SIGN_AND_SUBMIT_XDR,
];

/** Supported Stellar chains for WalletKit */
const stellarNamespaceChains = [
  StellarRpcChains.PUBLIC,
  StellarRpcChains.TESTNET,
];

/** Supported Stellar events for WalletKit */
const stellarNamespaceEvents = [StellarRpcEvents.ACCOUNT_CHANGED];

/** Global WalletKit instance */
// eslint-disable-next-line import/no-mutable-exports
export let walletKit: IWalletKit;

/**
 * Initializes the WalletKit instance with core configuration
 * @returns {Promise<void>} A promise that resolves when initialization is complete
 */
export const createWalletKit = async () => {
  const core = new Core({
    projectId: WALLET_KIT_PROJECT_ID,
  });

  walletKit = await WalletKit.init({
    core,
    metadata: WALLET_KIT_METADATA,
  });
};

/**
 * Rejects a session proposal from a dApp
 * @param {Object} params - The parameters object
 * @param {WalletKitSessionProposal} params.sessionProposal - The session proposal to reject
 * @param {string} params.message - The rejection message
 * @returns {Promise<void>} A promise that resolves when the rejection is complete
 */
export const rejectSessionProposal = async ({
  sessionProposal,
  message,
}: {
  sessionProposal: WalletKitSessionProposal;
  message: string;
}) => {
  try {
    await walletKit.rejectSession({
      id: sessionProposal.id,
      reason: getSdkError("USER_REJECTED" as SdkErrorKey, message),
    });
  } catch (error) {
    logger.error(
      "rejectSessionProposal",
      "Failed to reject session proposal",
      error,
    );
  }
};

/**
 * Approves a session proposal from a dApp
 * @param {Object} params - The parameters object
 * @param {WalletKitSessionProposal} params.sessionProposal - The session proposal to approve
 * @param {string[]} params.activeAccounts - List of active account addresses
 * @param {Function} params.showToast - Function to display toast messages
 * @param {TFunction} params.t - Translation function
 * @returns {Promise<void>} A promise that resolves when the approval is complete
 */
export const approveSessionProposal = async ({
  sessionProposal,
  activeAccounts,
  showToast,
  t,
}: {
  sessionProposal: WalletKitSessionProposal;
  activeAccounts: string[];
  showToast: (options: ToastOptions) => void;
  t: TFunction<"translations", undefined>;
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
      showToast({
        title: t("walletKit.connectionSuccessfull", {
          dappName: session.peer.metadata.name,
        }),
        message: t("walletKit.returnToBrowser"),
        variant: "success",
      });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : t("common.unknownError");
    showToast({
      title: t("walletKit.errorConnecting", {
        dappName: params.proposer.metadata.name,
      }),
      message: t("common.error", {
        errorMessage,
      }),
      variant: "error",
    });
    rejectSessionProposal({ sessionProposal, message: errorMessage });
  }
};

/**
 * Rejects a session request from a dApp
 * @param {Object} params - The parameters object
 * @param {WalletKitSessionRequest} params.sessionRequest - The session request to reject
 * @param {string} params.message - The rejection message
 * @returns {Promise<void>} A promise that resolves when the rejection is complete
 */
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

/**
 * Approves and processes a session request from a dApp
 * @param {Object} params - The parameters object
 * @param {WalletKitSessionRequest} params.sessionRequest - The session request to approve
 * @param {Function} params.signTransaction - Function to sign the transaction
 * @param {string} params.networkPassphrase - The network passphrase
 * @param {string} params.activeChain - The active chain identifier
 * @param {Function} params.showToast - Function to display toast messages
 * @param {TFunction} params.t - Translation function
 * @returns {Promise<void>} A promise that resolves when the approval is complete
 */
export const approveSessionRequest = async ({
  sessionRequest,
  signTransaction,
  networkPassphrase,
  activeChain,
  showToast,
  t,
}: {
  sessionRequest: WalletKitSessionRequest;
  signTransaction: (
    transaction: Transaction | FeeBumpTransaction,
  ) => string | null;
  networkPassphrase: string;
  activeChain: string;
  showToast: (options: ToastOptions) => void;
  t: TFunction<"translations", undefined>;
}) => {
  const { id, params, topic } = sessionRequest;
  const { request, chainId } = params || {};
  const { params: requestParams } = request || {};
  const { xdr } = requestParams || {};

  if (chainId !== activeChain) {
    const targetNetworkName =
      chainId === (StellarRpcChains.PUBLIC as string)
        ? NETWORK_NAMES.PUBLIC
        : NETWORK_NAMES.TESTNET;
    const message = t("walletKit.errorWrongNetworkMessage", {
      targetNetworkName,
    });

    showToast({
      title: t("walletKit.errorWrongNetwork"),
      message,
      variant: "error",
    });

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
    const message = t("common.error", {
      errorMessage:
        error instanceof Error ? error.message : t("common.unknownError"),
    });

    showToast({
      title: t("walletKit.errorSigning"),
      message,
      variant: "error",
    });

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

    showToast({
      title: t("walletKit.signingSuccessfull"),
      message: t("walletKit.returnToBrowser"),
      variant: "success",
    });
  } catch (error) {
    const message = t("common.error", {
      errorMessage:
        error instanceof Error ? error.message : t("common.unknownError"),
    });

    showToast({
      title: t("walletKit.errorRespondingRequest"),
      message,
      variant: "error",
    });

    rejectSessionRequest({ sessionRequest, message });
  }
};

/**
 * Retrieves all active WalletKit sessions
 * @returns {Promise<ActiveSessions>} A promise that resolves with the active sessions
 */
// eslint-disable-next-line @typescript-eslint/require-await
export const getActiveSessions = async () =>
  walletKit.getActiveSessions() as ActiveSessions;

/**
 * Disconnects all active WalletKit sessions for a given public key and network
 * If no public key or network is provided, it will disconnect all existing sessions
 * @param {string} publicKey - The public key of the account to disconnect sessions for
 * @param {NETWORKS} network - The network to disconnect sessions for
 * @returns {Promise<void>} A promise that resolves when all sessions are disconnected
 */
export const disconnectAllSessions = async (
  publicKey?: string,
  network?: NETWORKS,
): Promise<void> => {
  let activeSessions: ActiveSessions = {};

  try {
    if (publicKey === undefined || network === undefined) {
      activeSessions = walletKit.getActiveSessions() as ActiveSessions;
    } else {
      activeSessions = getActiveSessions(publicKey, network) as ActiveSessions;
    }

    await Promise.all(
      Object.values(activeSessions).map(async (activeSession) => {
        try {
          await walletKit.disconnectSession({
            topic: activeSession.topic,
            reason: getSdkError("USER_DISCONNECTED"),
          });
        } catch (error) {
          logger.error(
            "disconnectAllSessions",
            "Failed to disconnect a session",
            error,
          );
        }
      }),
    );
  } catch (error) {
    // Let's not block the user from logging out if this fails
    logger.error(
      "disconnectAllSessions",
      `Failed to disconnect all sessions. publicKey: ${publicKey}, network: ${network}`,
      error,
    );
  }
};
