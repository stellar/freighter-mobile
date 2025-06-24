import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import DappConnectionBottomSheetContent from "components/screens/WalletKit/DappConnectionBottomSheetContent";
import DappRequestBottomSheetContent from "components/screens/WalletKit/DappRequestBottomSheetContent";
import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
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

  const initialized = useWalletKitInitialize();
  useWalletKitEventsManager(initialized);

  const { event, clearEvent, fetchActiveSessions } = useWalletKitStore();
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

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const publicKey = account?.publicKey;

  const activeChain = useMemo(
    () =>
      network === NETWORKS.PUBLIC
        ? StellarRpcChains.PUBLIC
        : StellarRpcChains.TESTNET,
    [network],
  );

  const activeAccounts = useMemo(
    () => [
      `${StellarRpcChains.PUBLIC}:${publicKey}`,
      `${StellarRpcChains.TESTNET}:${publicKey}`,
    ],
    [publicKey],
  );

  const handleClearDappConnection = () => {
    dappConnectionBottomSheetModalRef.current?.dismiss();

    setTimeout(() => {
      setIsConnecting(false);
      setProposalEvent(null);
      clearEvent();
    }, 200);
  };

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

  const handleDappConnection = () => {
    if (!proposalEvent) {
      return;
    }

    setIsConnecting(true);

    approveSessionProposal({
      sessionProposal: proposalEvent,
      activeAccounts,
      showToast,
      t,
    }).finally(() => {
      handleClearDappConnection();

      // Fetch active sessions to display the new connection on the UI
      fetchActiveSessions(publicKey, network);
    });
  };

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

  useEffect(() => {
    if (event.type === WalletKitEventTypes.SESSION_PROPOSAL) {
      if (authStatus !== AUTH_STATUS.AUTHENTICATED) {
        showToast({
          title: t("walletKit.notAuthenticated"),
          message: t("walletKit.pleaseLoginToConnect"),
          variant: "error",
        });

        rejectSessionProposal({
          sessionProposal: event as WalletKitSessionProposal,
          message: t("walletKit.userNotAuthenticated"),
        });

        clearEvent();
        return;
      }

      handleClearDappRequest();
      setProposalEvent(event as WalletKitSessionProposal);
      dappConnectionBottomSheetModalRef.current?.present();
    }

    if (event.type === WalletKitEventTypes.SESSION_REQUEST) {
      if (authStatus !== AUTH_STATUS.AUTHENTICATED) {
        showToast({
          title: t("walletKit.notAuthenticated"),
          message: t("walletKit.pleaseLoginToSign"),
          variant: "error",
        });

        rejectSessionRequest({
          sessionRequest: event as WalletKitSessionRequest,
          message: t("walletKit.userNotAuthenticated"),
        });

        clearEvent();
        return;
      }

      handleClearDappConnection();
      setRequestEvent(event as WalletKitSessionRequest);
      dappRequestBottomSheetModalRef.current?.present();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.type, authStatus]);

  return (
    <View className="flex-1">
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
