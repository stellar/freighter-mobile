import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import DappConnectionBottomSheetContent from "components/screens/WalletKit/DappConnectionBottomSheetContent";
import DappRequestBottomSheetContent from "components/screens/WalletKit/DappRequestBottomSheetContent";
import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import {
  useWalletKitStore,
  WalletKitSessionProposal,
  WalletKitEventTypes,
  WalletKitSessionRequest,
  StellarRpcChains,
} from "ducks/walletKit";
import {
  approveSessionProposal,
  approveSessionRequest,
  rejectSessionRequest,
  rejectSessionProposal,
} from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useWalletKitEventsManager } from "hooks/useWalletKitEventsManager";
import { useWalletKitInitialize } from "hooks/useWalletKitInitialize";
import { useToast } from "providers/ToastProvider";
import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

/**
 * Props for the WalletKitProvider component
 * @interface WalletKitProviderProps
 * @property {ReactNode} children - Child components to be wrapped by the provider
 */
interface WalletKitProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages WalletConnect connections and request proposals.
 * Handles session proposals, requests, and maintains the connection state.
 *
 * Features:
 * - Manages dApp connection requests
 * - Handles transaction signing requests
 * - Maintains active sessions
 * - Provides bottom sheet modals for user interactions
 * - Validates authentication status before processing requests
 * - Automatically rejects invalid or unauthorized requests
 *
 * @component
 * @param {WalletKitProviderProps} props - The component props
 * @returns {JSX.Element} The provider component
 */
export const WalletKitProvider: React.FC<WalletKitProviderProps> = ({
  children,
}) => {
  const { network, authStatus } = useAuthenticationStore();
  const { account, signTransaction } = useGetActiveAccount();

  const publicKey = account?.publicKey || "";

  const initialized = useWalletKitInitialize();
  useWalletKitEventsManager(initialized);

  const { event, clearEvent, activeSessions, fetchActiveSessions } =
    useWalletKitStore();
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const [proposalEvent, setProposalEvent] =
    useState<WalletKitSessionProposal | null>(null);
  const [requestEvent, setRequestEvent] =
    useState<WalletKitSessionRequest | null>(null);

  const dappConnectionBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const dappRequestBottomSheetModalRef = useRef<BottomSheetModal>(null);

  /**
   * Network details mapped from the current network configuration
   * @type {NetworkDetails}
   */
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  /**
   * Active chain identifier for WalletConnect
   * @type {StellarRpcChains}
   */
  const activeChain = useMemo(
    () =>
      network === NETWORKS.PUBLIC
        ? StellarRpcChains.PUBLIC
        : StellarRpcChains.TESTNET,
    [network],
  );

  /**
   * Active account identifier in WalletConnect format
   * @type {string}
   */
  const activeAccount = useMemo(
    () => `${activeChain}:${publicKey}`,
    [activeChain, publicKey],
  );

  /**
   * Clears the dApp connection bottom sheet and resets connection state
   * @function handleClearDappConnection
   * @returns {void}
   */
  const handleClearDappConnection = () => {
    dappConnectionBottomSheetModalRef.current?.dismiss();

    setTimeout(() => {
      setIsConnecting(false);
      setProposalEvent(null);
      clearEvent();
    }, 200);
  };

  /**
   * Clears the dApp request bottom sheet and resets signing state
   * Also rejects the current request to prevent it from reappearing
   * @function handleClearDappRequest
   * @returns {void}
   */
  const handleClearDappRequest = () => {
    dappRequestBottomSheetModalRef.current?.dismiss();

    // We need to explicitly reject the request here otherwise
    // the app will show the request again on next app launch
    if (requestEvent) {
      rejectSessionRequest({
        sessionRequest: requestEvent,
        message: t("walletKit.userRejected"),
      });
    }

    setTimeout(() => {
      setIsSigning(false);
      setRequestEvent(null);
      clearEvent();
    }, 200);
  };

  /**
   * Handles dApp connection approval
   * Establishes a new WalletConnect session with the dApp
   * @function handleDappConnection
   * @returns {void}
   */
  const handleDappConnection = () => {
    if (!proposalEvent) {
      return;
    }

    setIsConnecting(true);

    // Establish a new dApp connection with the given
    // public key (activeAccount) and network (activeChain)
    approveSessionProposal({
      sessionProposal: proposalEvent,
      activeAccount,
      activeChain,
      showToast,
      t,
    }).finally(() => {
      handleClearDappConnection();

      // Fetch active sessions to display the new connection on the UI
      fetchActiveSessions(publicKey, network);
    });
  };

  /**
   * Handles dApp transaction request approval
   * Signs the transaction and sends the response back to the dApp
   * @function handleDappRequest
   * @returns {void}
   */
  const handleDappRequest = () => {
    if (!requestEvent) {
      return;
    }

    setIsSigning(true);

    approveSessionRequest({
      sessionRequest: requestEvent,
      signTransaction,
      networkPassphrase: networkDetails.networkPassphrase,
      activeChain,
      showToast,
      t,
    }).finally(() => {
      handleClearDappRequest();
    });
  };

  /**
   * Effect that handles WalletKit events (session proposals and requests).
   * Processes incoming session proposals and requests, validates authentication status,
   * and presents appropriate bottom sheet modals for user interaction.
   *
   * Handles:
   * - Session proposals: Validates authentication, shows dApp connection bottom sheet
   * - Session requests: Validates session exists and authentication, shows dApp transaction request bottom sheet
   * - Automatic rejection of invalid requests with appropriate error messages
   * - Authentication state validation before processing any requests
   *
   * @dependencies activeSessions, event.type, authStatus
   */
  useEffect(() => {
    if (event.type === WalletKitEventTypes.SESSION_PROPOSAL) {
      const sessionProposal = event as WalletKitSessionProposal;

      // Check if user is not authenticated
      if (authStatus === AUTH_STATUS.NOT_AUTHENTICATED) {
        showToast({
          title: t("walletKit.notAuthenticated"),
          message: t("walletKit.pleaseLoginToConnect"),
          variant: "error",
        });

        rejectSessionProposal({
          sessionProposal,
          message: t("walletKit.userNotAuthenticated"),
        });

        clearEvent();
        return;
      }

      // Check if wallet is locked
      if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
        showToast({
          title: t("walletKit.walletLocked"),
          message: t("walletKit.pleaseUnlockToConnect"),
          variant: "error",
        });
        return;
      }

      handleClearDappRequest();
      setProposalEvent(sessionProposal);
      dappConnectionBottomSheetModalRef.current?.present();
    }

    if (event.type === WalletKitEventTypes.SESSION_REQUEST) {
      const sessionRequest = event as WalletKitSessionRequest;

      // Check if user is not authenticated
      if (authStatus === AUTH_STATUS.NOT_AUTHENTICATED) {
        showToast({
          title: t("walletKit.notAuthenticated"),
          message: t("walletKit.pleaseLoginToSignTransaction"),
          variant: "error",
        });

        rejectSessionRequest({
          sessionRequest,
          message: t("walletKit.userNotAuthenticated"),
        });

        clearEvent();
        return;
      }

      // Check if wallet is locked
      if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
        showToast({
          title: t("walletKit.walletLocked"),
          message: t("walletKit.pleaseUnlockToSignTransaction"),
          variant: "error",
        });
        return;
      }

      // Wait for active sessions to be fetched
      if (Object.keys(activeSessions).length === 0) {
        return;
      }

      // Validate that the session exists
      if (!activeSessions[sessionRequest.topic]) {
        showToast({
          title: t("walletKit.connectionNotFound"),
          message: t("walletKit.connectionNotFoundMessage"),
          variant: "error",
        });

        logger.debug(
          "WalletKitProvider",
          "Event topic not found in active sessions:",
          sessionRequest.topic,
        );

        rejectSessionRequest({
          sessionRequest,
          message: `${t("walletKit.connectionNotFound")}. ${t("walletKit.connectionNotFoundMessage")}`,
        });

        clearEvent();
        return;
      }

      handleClearDappConnection();
      setRequestEvent(sessionRequest);
      dappRequestBottomSheetModalRef.current?.present();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessions, event.type, authStatus]);

  return (
    <View className="flex-1">
      {/* Bottom sheet for dApp connection requests */}
      <BottomSheet
        modalRef={dappConnectionBottomSheetModalRef}
        handleCloseModal={handleClearDappConnection}
        bottomSheetModalProps={{
          onDismiss: handleClearDappConnection,
        }}
        customContent={
          <DappConnectionBottomSheetContent
            account={account}
            proposalEvent={proposalEvent}
            isConnecting={isConnecting}
            onConnection={handleDappConnection}
            onCancel={handleClearDappConnection}
          />
        }
      />

      {/* Bottom sheet for dApp transaction requests */}
      <BottomSheet
        modalRef={dappRequestBottomSheetModalRef}
        handleCloseModal={handleClearDappRequest}
        bottomSheetModalProps={{
          onDismiss: handleClearDappRequest,
        }}
        customContent={
          <DappRequestBottomSheetContent
            account={account}
            requestEvent={requestEvent}
            isSigning={isSigning}
            onConfirm={handleDappRequest}
            onCancel={handleClearDappRequest}
          />
        }
      />
      {children}
    </View>
  );
};
