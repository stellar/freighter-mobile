import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { NETWORK_NAMES, NETWORKS } from "config/constants";
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
  useWalletKitStore,
} from "ducks/walletKit";
import { getDappMetadataFromEvent } from "hooks/useDappMetadata";
import { TFunction } from "i18next";
import { ToastOptions } from "providers/ToastProvider";
import { analytics } from "services/analytics";
import { submitTx } from "services/stellar";

/** Supported Stellar RPC methods for WalletKit */
const stellarNamespaceMethods = [
  StellarRpcMethods.SIGN_XDR,
  StellarRpcMethods.SIGN_AND_SUBMIT_XDR,
  StellarRpcMethods.SIGN_MESSAGE,
];

/** Supported Stellar RPC events for WalletKit */
const stellarNamespaceEvents = [StellarRpcEvents.ACCOUNTS_CHANGED];

/** Global WalletKit instance */
// eslint-disable-next-line import/no-mutable-exports
export let walletKit: IWalletKit;

/**
 * Initializes the WalletKit instance with core configuration
 * @returns {Promise<void>} A promise that resolves when initialization is complete
 */
export const createWalletKit = async (): Promise<void> => {
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
  activeChain,
  activeAccount,
  showToast,
  t,
}: {
  sessionProposal: WalletKitSessionProposal;
  activeChain: string;
  activeAccount: string;
  showToast: (options: ToastOptions) => void;
  t: TFunction<"translations", undefined>;
}) => {
  const { id, params } = sessionProposal;

  try {
    const proposalChains = [
      ...(params.requiredNamespaces?.stellar?.chains || []),
      ...(params.optionalNamespaces?.stellar?.chains || []),
    ];

    if (proposalChains.length === 0) {
      showToast({
        title: t("walletKit.errorUnsupportedChain"),
        message: t("walletKit.errorUnsupportedChainMessage"),
        variant: "error",
      });

      return;
    }

    if (!proposalChains.includes(activeChain)) {
      const targetNetworkName =
        proposalChains[0] === (StellarRpcChains.PUBLIC as string)
          ? NETWORK_NAMES.PUBLIC
          : NETWORK_NAMES.TESTNET;

      showToast({
        title: t("walletKit.errorWrongNetwork"),
        message: t("walletKit.errorWrongNetworkMessage", {
          targetNetworkName,
        }),
        variant: "error",
      });

      return;
    }

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: params,
      supportedNamespaces: {
        stellar: {
          accounts: [activeAccount],
          chains: [activeChain],
          methods: stellarNamespaceMethods,
          events: stellarNamespaceEvents,
        },
      },
    });

    const session = await walletKit.approveSession({
      id,
      namespaces: approvedNamespaces,
    });

    showToast({
      title: t("walletKit.connectionSuccessfull", {
        dappName: session.peer.metadata.name,
      }),
      message: t("walletKit.returnToBrowser"),
      variant: "success",
    });
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
  signMessage,
  networkPassphrase,
  activeChain,
  showToast,
  t,
}: {
  sessionRequest: WalletKitSessionRequest;
  signTransaction: (
    transaction: Transaction | FeeBumpTransaction,
  ) => string | null;
  signMessage: (message: string) => string | null;
  networkPassphrase: string;
  activeChain: string;
  showToast: (options: ToastOptions) => void;
  t: TFunction<"translations", undefined>;
}) => {
  const { id, params, topic } = sessionRequest;
  const { request, chainId } = params || {};
  const { params: requestParams, method: requestMethod } = request || {};
  const { xdr } = requestParams || {};

  const rpcMethod = requestMethod as StellarRpcMethods;

  const supportedChains = [StellarRpcChains.PUBLIC, StellarRpcChains.TESTNET];

  // Check if the chain is supported by the wallet
  if (!supportedChains.includes(chainId as StellarRpcChains)) {
    const message = t("walletKit.errorUnsupportedTransactionChainMessage", {
      chainId,
    });
    showToast({
      title: t("walletKit.errorUnsupportedTransactionChain"),
      message,
      variant: "error",
    });
    rejectSessionRequest({ sessionRequest, message });
    return;
  }

  const targetNetwork =
    chainId === (StellarRpcChains.PUBLIC as string)
      ? NETWORKS.PUBLIC
      : NETWORKS.TESTNET;

  if (chainId !== activeChain) {
    const targetNetworkName = NETWORK_NAMES[targetNetwork];
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

  // Handle SIGN_MESSAGE separately (doesn't involve transaction XDR)
  if (rpcMethod === StellarRpcMethods.SIGN_MESSAGE) {
    const { message } = requestParams || {};

    if (!message || typeof message !== "string") {
      const errorMessage = "Invalid message parameter";
      showToast({
        title: t("walletKit.errorSigning"),
        message: errorMessage,
        variant: "error",
      });
      rejectSessionRequest({ sessionRequest, message: errorMessage });
      return;
    }

    // Validate message length (1KB limit per SEP-53 recommendations)
    // Use UTF-8 byte length instead of UTF-16 character count
    const messageByteLength = new TextEncoder().encode(message).length;
    if (messageByteLength > 1024) {
      const errorMessage = "Message too long (max 1KB)";
      showToast({
        title: t("walletKit.errorSigning"),
        message: errorMessage,
        variant: "error",
      });
      rejectSessionRequest({ sessionRequest, message: errorMessage });
      return;
    }

    const signedMessage = signMessage(message);

    if (!signedMessage) {
      const errorMessage = "Failed to sign message";
      logger.error(
        "approveSessionRequest",
        errorMessage,
        new Error(errorMessage),
      );
      showToast({
        title: t("walletKit.errorSigning"),
        message: t("walletKit.pleaseTryAgainLater"),
        variant: "error",
      });
      rejectSessionRequest({ sessionRequest, message: errorMessage });
      return;
    }

    // Get dapp metadata for analytics
    const { activeSessions } = useWalletKitStore.getState();
    const dappMetadata = getDappMetadataFromEvent(
      sessionRequest,
      activeSessions,
    );
    const dappDomain = dappMetadata?.url;

    analytics.trackSignedMessage({
      messageLength: message.length,
      ...(dappDomain ? { dappDomain } : {}),
    });

    const response = {
      id,
      result: { signature: signedMessage },
      jsonrpc: "2.0",
    };

    try {
      await walletKit.respondSessionRequest({ topic, response });

      showToast({
        title: t("walletKit.signSuccessfull"),
        message: t("walletKit.returnToBrowser"),
        variant: "success",
      });
    } catch (err) {
      const errorMsg = t("common.error", {
        errorMessage:
          err instanceof Error ? err.message : t("common.unknownError"),
      });

      showToast({
        title: t("walletKit.errorRespondingRequest"),
        message: errorMsg,
        variant: "error",
      });

      rejectSessionRequest({ sessionRequest, message: errorMsg });
    }

    return;
  }

  // Transaction signing flow (for SIGN_XDR and SIGN_AND_SUBMIT_XDR)
  let transaction: Transaction | FeeBumpTransaction;
  let signedTransaction: string | null;
  let dappDomain: string | undefined;
  try {
    transaction = TransactionBuilder.fromXDR(xdr as string, networkPassphrase);

    // Always sign the transaction for both supported RPC methods
    signedTransaction = signTransaction(transaction);

    if (!signedTransaction) {
      const errorMessage = "Failed to sign transaction";
      logger.error(
        "approveSessionRequest",
        errorMessage,
        new Error(errorMessage),
      );
      showToast({
        title: t("walletKit.errorSigning"),
        message: t("walletKit.pleaseTryAgainLater"),
        variant: "error",
      });
      rejectSessionRequest({
        sessionRequest,
        message: t("common.error", { errorMessage }),
      });
      return;
    }

    // Get dapp metadata for analytics
    const { activeSessions } = useWalletKitStore.getState();
    const dappMetadata = getDappMetadataFromEvent(
      sessionRequest,
      activeSessions,
    );
    dappDomain = dappMetadata?.url;

    analytics.trackSignedTransaction({
      transactionHash: transaction.hash().toString("hex"),
      ...(dappDomain ? { dappDomain } : {}),
    });
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

  // Handle the different RPC methods
  if (rpcMethod === StellarRpcMethods.SIGN_AND_SUBMIT_XDR) {
    // For stellar_signAndSubmitXDR: sign AND submit, then return success status
    try {
      await submitTx({
        network: targetNetwork,
        tx: signedTransaction,
      });

      analytics.trackSubmittedTransaction({
        transactionHash: transaction.hash().toString("hex"),
        ...(dappDomain ? { dappDomain } : {}),
      });
    } catch (error) {
      const message = t("common.error", {
        errorMessage:
          error instanceof Error ? error.message : t("common.unknownError"),
      });

      showToast({
        title: t("walletKit.errorSubmitting"),
        message,
        variant: "error",
      });

      rejectSessionRequest({ sessionRequest, message });

      return;
    }

    try {
      const response = {
        id,
        result: { status: "success" as const },
        jsonrpc: "2.0",
      };

      await walletKit.respondSessionRequest({ topic, response });

      showToast({
        title: t("walletKit.signAndSubmitSuccessfull"),
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
  } else if (rpcMethod === StellarRpcMethods.SIGN_XDR) {
    // For stellar_signXDR: sign only, then return the signed transaction
    const response = {
      id,
      result: { signedXDR: signedTransaction },
      jsonrpc: "2.0",
    };

    try {
      await walletKit.respondSessionRequest({ topic, response });

      showToast({
        title: t("walletKit.signSuccessfull"),
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
  } else {
    // Unknown RPC method
    const message = t("walletKit.errorUnsupportedMethod", {
      method: rpcMethod || "unknown",
    });
    logger.error("approveSessionRequest", message, new Error(message));
    showToast({
      title: t("walletKit.errorUnsupportedMethodTitle"),
      message,
      variant: "error",
    });
    rejectSessionRequest({ sessionRequest, message });
  }
};

/**
 * Retrieves all active Wallet Connect sessions for a given public key and network
 * @param {string} publicKey - The public key of the account to get sessions for
 * @param {NETWORKS} network - The network to get sessions for
 * @returns {Promise<ActiveSessions>} A promise that resolves with the active sessions
 */
// eslint-disable-next-line @typescript-eslint/require-await
export const getActiveSessions = (
  publicKey: string,
  network: NETWORKS,
): ActiveSessions => {
  const allActiveSessions = walletKit.getActiveSessions() as ActiveSessions;
  const activeChain =
    network === NETWORKS.PUBLIC
      ? StellarRpcChains.PUBLIC
      : StellarRpcChains.TESTNET;
  const activeAccount = `${activeChain}:${publicKey}`;

  // Let's get only the sessions related to the active account
  const activeAccountSessions: ActiveSessions = Object.values(
    allActiveSessions,
  ).reduce((sessionsMap, session) => {
    if (
      session.namespaces.stellar.accounts.some(
        (account) => account === activeAccount,
      )
    ) {
      return {
        ...sessionsMap,
        [session.topic]: session,
      };
    }
    return sessionsMap;
  }, {} as ActiveSessions);

  return activeAccountSessions;
};

/**
 * Disconnects a specific Wallet Connect session by topic
 * @param {string} topic - The session topic to disconnect
 * @returns {Promise<void>} A promise that resolves when the session is disconnected
 */
export const disconnectSession = async (topic: string): Promise<void> => {
  try {
    await walletKit.disconnectSession({
      topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });

    logger.debug(
      "disconnectSession",
      `Session disconnected successfully. topic: ${topic}`,
    );
  } catch (error) {
    logger.error(
      "disconnectSession",
      `Failed to disconnect session. topic: ${topic}`,
      error,
    );
  }
};

/**
 * Disconnects all active Wallet Connect sessions for a given public key and network
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
      activeSessions = getActiveSessions(publicKey, network);
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

    logger.debug(
      "disconnectAllSessions",
      "All sessions disconnected successfully",
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

/**
 * Clears all WalletConnect storage data from AsyncStorage
 * This function removes all keys that start with 'wc@2:' which are used by WalletConnect
 * to store session data, proposals, and other connection information
 * This is safe to clear as WalletConnect re-creates everything as needed
 * @returns {Promise<void>} A promise that resolves when the storage clearing is complete
 */
export const clearWalletKitStorage = async (): Promise<boolean> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const wcKeys = allKeys.filter((key) => key.startsWith("wc@2:"));
    if (wcKeys.length > 0) {
      await AsyncStorage.multiRemove(wcKeys);
    }

    logger.debug(
      "clearWalletKitStorage",
      "All WalletKit storage cleared successfully",
    );

    return true;
  } catch (error) {
    logger.error("clearWalletKitStorage", "Failed to clear WC storage", error);

    return false;
  }
};
