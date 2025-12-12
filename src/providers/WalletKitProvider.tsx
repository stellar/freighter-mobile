import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AddMemoExplanationBottomSheet from "components/AddMemoExplanationBottomSheet";
import BottomSheet from "components/BottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import DappConnectionBottomSheetContent from "components/screens/WalletKit/DappConnectionBottomSheetContent";
import DappRequestBottomSheetContent from "components/screens/WalletKit/DappRequestBottomSheetContent";
import { AnalyticsEvent } from "config/analyticsConfig";
import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
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
import useAppTranslation from "hooks/useAppTranslation";
import { getDappMetadataFromEvent } from "hooks/useDappMetadata";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useValidateTransactionMemo } from "hooks/useValidateTransactionMemo";
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
import { SecurityLevel, SecurityContext } from "services/blockaid/constants";
import {
  assessSiteSecurity,
  assessTransactionSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";
import type { SecurityWarning } from "services/blockaid/helper";

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
  const { overriddenBlockaidResponse } = useDebugStore();

  const addMemoExplanationBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { transactionMemo, saveMemo } = useTransactionSettingsStore();

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

  const xdr = useMemo(
    () =>
      (requestEvent?.params.request.params as unknown as { xdr: string })
        ?.xdr ?? "",
    [requestEvent],
  );

  /**
   * Validates transaction memo requirements for incoming dApp transaction requests
   * Uses the useValidateTransactionMemo hook to check if the transaction
   * destination requires a memo and if one is currently missing
   */
  const { isMemoMissing, isValidatingMemo } = useValidateTransactionMemo(xdr);

  const dappConnectionBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const dappRequestBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const siteSecurityWarningBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [securityWarningContext, setSecurityWarningContext] =
    useState<SecurityContext>(SecurityContext.SITE);

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
    () => assessSiteSecurity(siteScanResult, overriddenBlockaidResponse),
    [siteScanResult, overriddenBlockaidResponse],
  );

  /**
   * Transaction security assessment based on scan result
   * @type {SecurityAssessment}
   */
  const transactionSecurityAssessment = useMemo(
    () =>
      assessTransactionSecurity(
        transactionScanResult,
        overriddenBlockaidResponse,
      ),
    [transactionScanResult, overriddenBlockaidResponse],
  );

  const signTransactionDetails = useSignTransactionDetails({ xdr });

  /**
   * Security warnings extracted from scan result
   * @type {SecurityWarning[]}
   */
  const siteSecurityWarnings = useMemo(() => {
    if (siteSecurityAssessment.isUnableToScan) {
      // For "Unable to scan" cases, always provide a warning so the list renders
      return [
        {
          id: "unable-to-scan",
          description:
            siteSecurityAssessment.details ||
            t("blockaid.unableToScan.site.description"),
        },
      ];
    }

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
    siteSecurityAssessment.isUnableToScan,
    siteSecurityAssessment.details,
    siteScanResult,
    t,
  ]);

  const transactionSecurityWarnings = useMemo(() => {
    if (transactionSecurityAssessment.isUnableToScan) {
      // For "Unable to scan" cases, always provide a warning so the list renders
      return [
        {
          id: "unable-to-scan",
          description:
            transactionSecurityAssessment.details ||
            t("securityWarning.unsafeTransaction"),
        },
      ];
    }

    if (
      transactionSecurityAssessment.isMalicious ||
      transactionSecurityAssessment.isSuspicious
    ) {
      const warnings = extractSecurityWarnings(transactionScanResult);

      if (Array.isArray(warnings) && warnings.length > 0) {
        return warnings;
      }
    }

    return [];
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    transactionSecurityAssessment.isUnableToScan,
    transactionSecurityAssessment.details,
    transactionScanResult,
    t,
  ]);

  /**
   * Security severity level for the bottom sheet
   * @type {SecurityLevel | undefined}
   */
  const siteSecuritySeverity = useMemo(() => {
    if (siteSecurityAssessment.isMalicious) return SecurityLevel.MALICIOUS;
    if (siteSecurityAssessment.isSuspicious) return SecurityLevel.SUSPICIOUS;
    if (siteSecurityAssessment.isUnableToScan)
      return SecurityLevel.UNABLE_TO_SCAN;

    return undefined;
  }, [
    siteSecurityAssessment.isMalicious,
    siteSecurityAssessment.isSuspicious,
    siteSecurityAssessment.isUnableToScan,
  ]);

  const transactionSecuritySeverity = useMemo(() => {
    if (transactionSecurityAssessment.isMalicious)
      return SecurityLevel.MALICIOUS;
    if (transactionSecurityAssessment.isSuspicious)
      return SecurityLevel.SUSPICIOUS;
    if (transactionSecurityAssessment.isUnableToScan)
      return SecurityLevel.UNABLE_TO_SCAN;

    return undefined;
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    transactionSecurityAssessment.isUnableToScan,
  ]);

  // =============================================================================
  // Security warning helpers (context-aware)
  // =============================================================================
  const getWarnings = useCallback(
    (): SecurityWarning[] =>
      securityWarningContext === SecurityContext.SITE
        ? siteSecurityWarnings
        : transactionSecurityWarnings,
    [securityWarningContext, siteSecurityWarnings, transactionSecurityWarnings],
  );

  const getSeverity = useCallback(
    (): Exclude<SecurityLevel, SecurityLevel.SAFE> | undefined =>
      securityWarningContext === SecurityContext.SITE
        ? siteSecuritySeverity
        : transactionSecuritySeverity,
    [securityWarningContext, siteSecuritySeverity, transactionSecuritySeverity],
  );

  const getProceedAnywayText = useCallback((): string => {
    const isUnableToScan =
      securityWarningContext === SecurityContext.SITE
        ? siteSecurityAssessment.level === SecurityLevel.UNABLE_TO_SCAN
        : transactionSecurityAssessment.level === SecurityLevel.UNABLE_TO_SCAN;

    if (isUnableToScan) {
      return t("common.continue");
    }

    return securityWarningContext === SecurityContext.SITE
      ? t("dappConnectionBottomSheetContent.connectAnyway")
      : t("dappRequestBottomSheetContent.confirmAnyway");
  }, [
    securityWarningContext,
    siteSecurityAssessment.level,
    transactionSecurityAssessment.level,
    t,
  ]);

  /**
   * Clears the dApp connection bottom sheet and resets connection state
   * @function handleClearDappConnection
   * @returns {void}
   */
  const handleClearDappConnection = () => {
    dappConnectionBottomSheetModalRef.current?.dismiss();
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();
    // Also ensure other sheets are closed to avoid any leftovers
    dappRequestBottomSheetModalRef.current?.dismiss();

    setTimeout(() => {
      setIsConnecting(false);
      setProposalEvent(null);
      setSiteScanResult(undefined);
      setSecurityWarningContext(SecurityContext.SITE);
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
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();

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
      setTransactionScanResult(undefined);
      setSecurityWarningContext(SecurityContext.SITE);
      saveMemo("");
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
   * For connection requests, dismisses the main sheet first
   * For transaction requests, overlays security detail on top (dismissing would cancel the request)
   * @function presentSecurityWarningDetail
   * @returns {void}
   */
  const presentSecurityWarningDetail = useCallback(
    (context: SecurityContext) => {
      setSecurityWarningContext(context);

      // For connection requests, dismiss the main sheet before showing security detail
      // For transaction requests, don't dismiss - it would cancel the request
      if (context === SecurityContext.SITE) {
        dappConnectionBottomSheetModalRef.current?.dismiss();
      }

      siteSecurityWarningBottomSheetModalRef.current?.present();
    },
    [],
  );

  /**
   * Handles proceeding anyway from security warning (context-aware)
   */
  const handleProceedAnyway = (): void => {
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();

    const isUnableToScan =
      securityWarningContext === SecurityContext.SITE
        ? siteSecurityAssessment.isUnableToScan
        : transactionSecurityAssessment.isUnableToScan;

    if (securityWarningContext === SecurityContext.SITE) {
      if (isUnableToScan) {
        dappConnectionBottomSheetModalRef.current?.present();
        return;
      }

      handleDappConnection();
      return;
    }

    if (isUnableToScan) {
      dappRequestBottomSheetModalRef.current?.present();
      return;
    }

    handleDappRequest();
  };

  /**
   * Handles canceling from security warning
   * Closes the security warning bottom sheet and cancels the connection
   * @function handleCancelSecurityWarning
   * @returns {void}
   */
  const handleCancelSecurityWarning = useCallback(() => {
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();

    setSecurityWarningContext(SecurityContext.SITE);
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
          // Check security assessment inline to decide which sheet to open
          const securityAssessment = assessSiteSecurity(
            scanResult,
            overriddenBlockaidResponse,
          );
          if (securityAssessment.isUnableToScan) {
            // For unable to scan, open security detail sheet first (main sheet not opened yet)
            setSecurityWarningContext(SecurityContext.SITE);
            siteSecurityWarningBottomSheetModalRef.current?.present();
          } else {
            dappConnectionBottomSheetModalRef.current?.present();
          }
        })
        .catch(() => {
          setSiteScanResult(undefined);
          const securityAssessment = assessSiteSecurity(
            undefined,
            overriddenBlockaidResponse,
          );
          if (securityAssessment.isUnableToScan) {
            setSecurityWarningContext(SecurityContext.SITE);
            siteSecurityWarningBottomSheetModalRef.current?.present();
          } else {
            dappConnectionBottomSheetModalRef.current?.present();
          }
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

      // Validate that the transaction request origin is legit
      const transactionRequestOrigin =
        sessionRequest.verifyContext?.verified?.origin;
      const isValidTransactionRequestOrigin = Object.values(
        activeSessions,
      ).some(
        (session) => session.peer?.metadata?.url === transactionRequestOrigin,
      );
      if (!isValidTransactionRequestOrigin) {
        showToast({
          title: t("walletKit.invalidTransactionOrigin"),
          message: t("walletKit.invalidTransactionOriginMessage", {
            transactionRequestOrigin,
          }),
          variant: "error",
        });

        logger.error(
          "WalletKitProvider",
          "Invalid transaction origin",
          new Error("Invalid transaction origin, potentially bad actor found"),
          {
            transactionRequestOrigin,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            xdr: sessionRequest.params?.request?.params?.xdr,
          },
        );

        rejectSessionRequest({
          sessionRequest,
          message: `${t("walletKit.invalidTransactionOrigin")}: ${transactionRequestOrigin}.`,
        });

        clearEvent();
        return;
      }

      setRequestEvent(sessionRequest);

      const dappMetadata = getDappMetadataFromEvent(
        sessionRequest,
        activeSessions,
      );

      const dappDomain = dappMetadata?.url as string;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const requestXdr = sessionRequest.params.request.params.xdr as string;

      scanTransaction(requestXdr, dappDomain)
        .then((scanResult) => {
          setTransactionScanResult(scanResult);
          // Check security assessment inline to decide which sheet to open
          const securityAssessment = assessTransactionSecurity(
            scanResult,
            overriddenBlockaidResponse,
          );
          if (securityAssessment.isUnableToScan) {
            // For unable to scan, open security detail sheet first (main sheet not opened yet)
            // Don't dismiss request sheet - it hasn't been opened yet and dismissing would cancel it
            setSecurityWarningContext(SecurityContext.TRANSACTION);
            siteSecurityWarningBottomSheetModalRef.current?.present();
          } else {
            dappRequestBottomSheetModalRef.current?.present();
          }
        })
        .catch(() => {
          setTransactionScanResult(undefined);
          // If scan fails, treat as unable to scan
          const securityAssessment = assessTransactionSecurity(
            undefined,
            overriddenBlockaidResponse,
          );
          if (securityAssessment.isUnableToScan) {
            // For unable to scan, open security detail sheet first (main sheet not opened yet)
            // Don't dismiss request sheet - it hasn't been opened yet and dismissing would cancel it
            setSecurityWarningContext(SecurityContext.TRANSACTION);
            siteSecurityWarningBottomSheetModalRef.current?.present();
          } else {
            dappRequestBottomSheetModalRef.current?.present();
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSessions,
    event.type,
    authStatus,
    transactionMemo,
    overriddenBlockaidResponse,
  ]);

  const onCancelAddMemo = () => {
    addMemoExplanationBottomSheetModalRef.current?.dismiss();
    dappRequestBottomSheetModalRef.current?.present();
  };

  /**
   * Opens the memo explanation bottom sheet for dApp transaction requests
   * This is shown when a transaction requires a memo but none is provided
   */
  const onOpenAddMemoExplanationBottomSheet = () => {
    addMemoExplanationBottomSheetModalRef.current?.present();
  };

  return (
    <View className="flex-1">
      {/* Bottom sheet for dApp connection requests */}
      <BottomSheet
        modalRef={dappConnectionBottomSheetModalRef}
        handleCloseModal={handleClearDappConnection}
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
            isUnableToScan={siteSecurityAssessment.isUnableToScan}
            securityWarningAction={() =>
              presentSecurityWarningDetail(SecurityContext.SITE)
            }
            proceedAnywayAction={() =>
              presentSecurityWarningDetail(SecurityContext.SITE)
            }
          />
        }
      />

      {/* Bottom sheet for dApp transaction requests */}
      <BottomSheet
        modalRef={dappRequestBottomSheetModalRef}
        handleCloseModal={handleClearDappRequest}
        analyticsEvent={AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION}
        bottomSheetModalProps={{
          onDismiss: handleClearDappRequest,
        }}
        customContent={
          <DappRequestBottomSheetContent
            account={account}
            requestEvent={requestEvent}
            isSigning={isSigning}
            isValidatingMemo={isValidatingMemo}
            onBannerPress={onOpenAddMemoExplanationBottomSheet}
            onConfirm={handleDappRequest}
            onCancelRequest={handleClearDappRequest}
            isMalicious={transactionSecurityAssessment.isMalicious}
            isSuspicious={transactionSecurityAssessment.isSuspicious}
            isUnableToScan={transactionSecurityAssessment.isUnableToScan}
            transactionScanResult={transactionScanResult}
            securityWarningAction={() =>
              presentSecurityWarningDetail(SecurityContext.TRANSACTION)
            }
            proceedAnywayAction={() =>
              presentSecurityWarningDetail(SecurityContext.TRANSACTION)
            }
            signTransactionDetails={signTransactionDetails}
            isMemoMissing={isMemoMissing}
          />
        }
      />

      <BottomSheet
        modalRef={addMemoExplanationBottomSheetModalRef}
        handleCloseModal={onCancelAddMemo}
        customContent={
          <AddMemoExplanationBottomSheet onClose={onCancelAddMemo} />
        }
      />

      {/* generic Bottom sheet for security warnings - site and transaction */}
      <BottomSheet
        modalRef={siteSecurityWarningBottomSheetModalRef}
        handleCloseModal={handleCancelSecurityWarning}
        customContent={
          <SecurityDetailBottomSheet
            warnings={getWarnings()}
            onCancel={handleCancelSecurityWarning}
            onProceedAnyway={handleProceedAnyway}
            onClose={handleCancelSecurityWarning}
            securityContext={securityWarningContext}
            severity={getSeverity()}
            proceedAnywayText={getProceedAnywayText()}
          />
        }
      />
      {children}
    </View>
  );
};
