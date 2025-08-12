import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import BottomSheet from "components/BottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import DappConnectionBottomSheetContent from "components/screens/WalletKit/DappConnectionBottomSheetContent";
import DappRequestBottomSheetContent from "components/screens/WalletKit/DappRequestBottomSheetContent";
import { AnalyticsEvent } from "config/analyticsConfig";
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
import { useBlockaidSite } from "hooks/blockaid/useBlockaidSite";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useTransactionBalanceListItems from "hooks/blockaid/useTransactionBalanceListItems";
import useAppTranslation from "hooks/useAppTranslation";
import { getDappMetadataFromEvent } from "hooks/useDappMetadata";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useWalletKitEventsManager } from "hooks/useWalletKitEventsManager";
import { useWalletKitInitialize } from "hooks/useWalletKitInitialize";
import { useToast } from "providers/ToastProvider";
import React, {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessSiteSecurity,
  assessTransactionSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

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
 * - Scans dApp URLs using Blockaid before showing connection UI
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
  const { scanSite } = useBlockaidSite();
  const { scanTransaction } = useBlockaidTransaction();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const [proposalEvent, setProposalEvent] =
    useState<WalletKitSessionProposal | null>(null);
  const [requestEvent, setRequestEvent] =
    useState<WalletKitSessionRequest | null>(null);
  const [siteScanResult, setSiteScanResult] = useState<
    Blockaid.SiteScanResponse | undefined
  >(undefined);
  const [transactionScanResult, setTransactionScanResult] = useState<
    Blockaid.StellarTransactionScanResponse | undefined
  >(undefined);

  const dappConnectionBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const dappRequestBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const siteSecurityWarningBottomSheetModalRef = useRef<BottomSheetModal>(null);

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
   * Site security assessment based on scan result
   * @type {SecurityAssessment}
   */
  const siteSecurityAssessment = useMemo(
    () => assessSiteSecurity(siteScanResult),
    [siteScanResult],
  );

  /**
   * Transaction security assessment based on scan result
   * @type {SecurityAssessment}
   */
  const transactionSecurityAssessment = useMemo(
    () => assessTransactionSecurity(transactionScanResult),
    [transactionScanResult],
  );

  const transactionBalanceListItems = useTransactionBalanceListItems(
    transactionScanResult,
  );

  /**
   * Security warnings extracted from scan result
   * @type {SecurityWarning[]}
   */
  const siteSecurityWarnings = useMemo(() => {
    if (
      siteSecurityAssessment.isMalicious ||
      siteSecurityAssessment.isSuspicious
    ) {
      const warnings = extractSecurityWarnings(siteScanResult);

      if (Array.isArray(warnings) && warnings.length > 0) {
        return warnings;
      }
    }

    return [];
  }, [
    siteSecurityAssessment.isMalicious,
    siteSecurityAssessment.isSuspicious,
    siteScanResult,
  ]);

  /**
   * Security severity level for the bottom sheet
   * @type {SecurityLevel | undefined}
   */
  const siteSecuritySeverity = useMemo(() => {
    if (siteSecurityAssessment.isMalicious) return SecurityLevel.MALICIOUS;
    if (siteSecurityAssessment.isSuspicious) return SecurityLevel.SUSPICIOUS;

    return undefined;
  }, [siteSecurityAssessment.isMalicious, siteSecurityAssessment.isSuspicious]);

  /**
   * Clears the dApp connection bottom sheet and resets connection state
   * @function handleClearDappConnection
   * @returns {void}
   */
  const handleClearDappConnection = () => {
    dappConnectionBottomSheetModalRef.current?.dismiss();
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();

    setTimeout(() => {
      setIsConnecting(false);
      setProposalEvent(null);
      setSiteScanResult(undefined);

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

    analytics.trackGrantAccessSuccess(
      proposalEvent.params.proposer.metadata.url,
    );

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
   * Handles security warning action
   * Opens the security warning bottom sheet with detailed information
   * @function handleSecurityWarning
   * @returns {void}
   */
  const presentSecurityWarningDetail = useCallback(() => {
    siteSecurityWarningBottomSheetModalRef.current?.present();
  }, []);

  /**
   * Handles proceeding anyway from security warning
   * Closes the security warning bottom sheet and proceeds with connection
   * @function handleProceedAnyway
   * @returns {void}
   */
  const handleProceedAnyway = () => {
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();

    handleDappConnection();
  };

  /**
   * Handles canceling from security warning
   * Closes the security warning bottom sheet and cancels the connection
   * @function handleCancelSecurityWarning
   * @returns {void}
   */
  const handleCancelSecurityWarning = useCallback(() => {
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();
  }, []);

  /**
   * Effect that handles WalletKit events (session proposals and requests).
   * Processes incoming session proposals and requests, validates authentication status,
   * scans dApp URLs for security, and presents appropriate bottom sheet modals for user interaction.
   *
   * Handles:
   * - Session proposals: Validates authentication, scans dApp URL, shows dApp connection bottom sheet
   * - Session requests: Validates session exists and authentication, shows dApp transaction request bottom sheet
   * - Automatic rejection of invalid requests with appropriate error messages
   * - Authentication state validation before processing any requests
   * - Blockaid security scanning before showing connection UI
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

        analytics.trackGrantAccessFail(
          sessionProposal.params.proposer.metadata.url,
          "user_not_authenticated",
        );

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

      const dappMetadata = getDappMetadataFromEvent(
        sessionProposal,
        activeSessions,
      );
      const dappDomain = dappMetadata?.url as string;

      scanSite(dappDomain)
        .then((scanResult) => {
          setSiteScanResult(scanResult);
        })
        .catch(() => {
          setSiteScanResult(undefined);
        })
        .finally(() => {
          // Show the connection bottom sheet after scanning (regardless of result)
          dappConnectionBottomSheetModalRef.current?.present();
        });
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

      const dappMetadata = getDappMetadataFromEvent(
        sessionRequest,
        activeSessions,
      );
      const dappDomain = dappMetadata?.url as string;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const dappXDR = sessionRequest.params.request.params.xdr as string;

      // const dappDomain = "https://blend.capital/";
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      // const dappXDR = "AAAAAgAAAAAFFiR6jieroloALNh43DoDye2makRSXE5C9NvmWTksNgABhqADcRjWAAAADQAAAAEAAAAAAAAAAAAAAABowb7eAAAAAQAAAAR0ZXN0AAAAAQAAAAAAAAABAAAAAG8AA/fcwyuD4aOECPqaDj9YZylgHFWI0/EXuK9av2pWAAAAAAAAAAAAD0JAAAAAAAAAAAA=";
      // const dappXDR = "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";

      scanTransaction(dappXDR, dappDomain)
        .then((scanResult) => {
          setTransactionScanResult(scanResult);
          const transaction = TransactionBuilder.fromXDR(dappXDR, networkDetails.networkPassphrase);
          logger.debug("transaction", JSON.stringify(transaction));
        })
        .catch(() => {
          setTransactionScanResult(undefined);
        })
        .finally(() => {
          // Show the transaction bottom sheet after scanning (regardless of result)
          dappRequestBottomSheetModalRef.current?.present();
        });
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
        analyticsEvent={AnalyticsEvent.VIEW_GRANT_DAPP_ACCESS}
        customContent={
          <DappConnectionBottomSheetContent
            account={account}
            proposalEvent={proposalEvent}
            isConnecting={isConnecting}
            onConnection={handleDappConnection}
            onCancel={handleClearDappConnection}
            isMalicious={siteSecurityAssessment.isMalicious}
            isSuspicious={siteSecurityAssessment.isSuspicious}
            securityWarningAction={presentSecurityWarningDetail}
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
        analyticsEvent={AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION}
        customContent={
          <DappRequestBottomSheetContent
            account={account}
            requestEvent={requestEvent}
            isSigning={isSigning}
            onConfirm={handleDappRequest}
            onCancel={handleClearDappRequest}
            isMalicious={transactionSecurityAssessment.isMalicious}
            isSuspicious={transactionSecurityAssessment.isSuspicious}
            transactionBalanceListItems={transactionBalanceListItems}
          />
        }
      />

      {/* Bottom sheet for site security warnings */}
      <BottomSheet
        modalRef={siteSecurityWarningBottomSheetModalRef}
        handleCloseModal={handleCancelSecurityWarning}
        customContent={
          <SecurityDetailBottomSheet
            warnings={siteSecurityWarnings}
            onCancel={handleCancelSecurityWarning}
            onProceedAnyway={handleProceedAnyway}
            onClose={handleCancelSecurityWarning}
            severity={siteSecuritySeverity}
            proceedAnywayText={t(
              "dappConnectionBottomSheetContent.connectAnyway",
            )}
          />
        }
      />
      {children}
    </View>
  );
};
