import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  Transaction,
  TransactionBuilder,
  xdr as stellarXdr,
} from "@stellar/stellar-sdk";
import AddMemoExplanationBottomSheet from "components/AddMemoExplanationBottomSheet";
import BottomSheet from "components/BottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import DappConnectionBottomSheetContent from "components/screens/WalletKit/DappConnectionBottomSheetContent";
import DappRequestBottomSheetContent from "components/screens/WalletKit/DappRequestBottomSheetContent";
import Icon from "components/sds/Icon";
import { AnalyticsEvent } from "config/analyticsConfig";
import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import {
  DappApprovalKind,
  DappErrorCode,
  type DappRequest,
  DappTransport,
} from "config/dappRequest";
import { logger } from "config/logger";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useDappApprovalStore } from "ducks/dappApproval";
import { useDebugStore } from "ducks/debug";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import {
  useWalletKitStore,
  WalletKitSessionProposal,
  WalletKitEventTypes,
  WalletKitSessionRequest,
  StellarRpcChains,
  StellarRpcMethods,
} from "ducks/walletKit";
import { isE2ETest } from "helpers/isEnv";
import { getHostname } from "helpers/protocols";
import {
  approveSessionProposal,
  executeDappRequest,
  rejectDappRequest,
  toDappRequest,
  rejectSessionRequest,
  rejectSessionProposal,
  resolveDappRejectionEvent,
} from "helpers/walletKitUtil";
import {
  validateSignMessageContent,
  validateSignMessageLength,
  validateSignAuthEntryContent,
  parseAuthEntryPreimage,
  validateAuthEntryNetwork,
  validateAuthEntryAddress,
} from "helpers/walletKitValidation";
import { useBlockaidSite } from "hooks/blockaid/useBlockaidSite";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
  const { themeColors } = useColors();
  const { network, authStatus } = useAuthenticationStore();
  const { account, signTransaction, signMessage, signAuthEntry } =
    useGetActiveAccount();
  const { overriddenBlockaidResponse } = useDebugStore();

  const addMemoExplanationBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { transactionMemo, saveMemo } = useTransactionSettingsStore();

  const publicKey = account?.publicKey || "";

  const initialized = useWalletKitInitialize();
  useWalletKitEventsManager(initialized);

  const { event, clearEvent, setEvent, activeSessions, fetchActiveSessions } =
    useWalletKitStore();
  const { showToast } = useToast();
  const { t } = useAppTranslation();
  const { scanSite } = useBlockaidSite();
  const { scanTransaction } = useBlockaidTransaction();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [proposalEvent, setProposalEvent] =
    useState<WalletKitSessionProposal | null>(null);
  const [requestEvent, setRequestEvent] = useState<DappRequest | null>(null);
  const [siteScanResult, setSiteScanResult] = useState<
    Blockaid.SiteScanResponse | undefined
  >(undefined);
  const [transactionScanResult, setTransactionScanResult] = useState<
    Blockaid.StellarTransactionScanResponse | undefined
  >(undefined);

  // Request queue to prevent concurrent request handling race conditions
  const isProcessingRequestRef = useRef(false);
  const activeProposalRef = useRef<number | null>(null);
  const activeRequestRef = useRef<DappRequest | null>(null);
  const isClearingRequestRef = useRef(false);
  const securityWarningDecisionRef = useRef(false);
  const webviewJob = useDappApprovalStore((state) => state.job);
  const setWalletConnectBusy = useDappApprovalStore(
    (state) => state.setWalletConnectBusy,
  );
  const handledWebviewJobRef = useRef<DappRequest | null>(null);
  /** Releases the active request slot after a rejection so the next queued request can proceed. */
  const resetActiveRequest = () => {
    activeRequestRef.current = null;
    isProcessingRequestRef.current = false;
    setWalletConnectBusy(false);
  };
  const pendingRequestsQueueRef = useRef<WalletKitSessionRequest[]>([]);
  // Guard against double-reject: set to true once executeDappRequest has sent
  // its own response (success or handled error) so handleClearDappRequest doesn't
  // send a duplicate rejection when it fires via .finally().
  const hasRespondedRef = useRef(false);
  // True once the user has committed to approving (handleDappRequest called
  // executeDappRequest). Distinguishes an approval attempt — whether it
  // succeeds or throws — from a genuine user dismissal, so the exceptional
  // approve-threw path isn't miscounted as a signing.*_rejected. Reset with
  // hasRespondedRef in the teardown.
  const approvalInFlightRef = useRef(false);

  const xdr = useMemo(
    () =>
      typeof requestEvent?.params.request.params?.xdr === "string"
        ? requestEvent.params.request.params.xdr
        : "",
    [requestEvent],
  );

  const requestMethod = useMemo(
    () => requestEvent?.params.request.method,
    [requestEvent],
  );

  const isSignMessageRequest = useMemo(
    () => requestMethod === StellarRpcMethods.SIGN_MESSAGE,
    [requestMethod],
  );

  const isSignAuthEntryRequest = useMemo(
    () => requestMethod === StellarRpcMethods.SIGN_AUTH_ENTRY,
    [requestMethod],
  );

  // Both sign_message and sign_auth_entry are non-transaction requests:
  // they skip memo validation and Blockaid transaction scanning
  const isNonTransactionRequest =
    isSignMessageRequest || isSignAuthEntryRequest;

  /**
   * Validates transaction memo requirements for incoming dApp transaction requests
   * Uses the useValidateTransactionMemo hook to check if the transaction
   * destination requires a memo and if one is currently missing
   * Only validates for XDR-based requests (not sign_message)
   */
  const { isMemoMissing: isMemoMissingRaw, isValidatingMemo } =
    useValidateTransactionMemo(xdr);

  // Only apply memo validation to XDR-based requests, not sign_message or sign_auth_entry
  const isMemoMissing = isNonTransactionRequest ? false : isMemoMissingRaw;

  const dappConnectionBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const dappRequestBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const siteSecurityWarningBottomSheetModalRef = useRef<BottomSheetModal>(null);
  // The site and transaction warnings share one BottomSheetModal. Presenting it
  // while its previous dismissal is still animating lets that dismissal's
  // onDismiss fire against the new presentation and cancel it (the signing
  // sheet then never appears and the dApp waits forever). Track presentation
  // and in-flight dismissal so a present during a dismiss is deferred to
  // onDismiss instead.
  const securityWarningPresentedRef = useRef(false);
  const securityWarningDismissingRef = useRef(false);
  const securityWarningPendingPresentRef = useRef(false);
  /** Presents the shared security warning sheet, deferring until an in-flight dismiss has settled. */
  const presentSecurityWarning = () => {
    if (securityWarningDismissingRef.current) {
      securityWarningPendingPresentRef.current = true;
      return;
    }
    securityWarningPresentedRef.current = true;
    securityWarningDecisionRef.current = false;
    siteSecurityWarningBottomSheetModalRef.current?.present();
  };
  /** Dismisses the shared security warning sheet if presented; onDismiss replays a deferred present. */
  const dismissSecurityWarning = () => {
    if (!securityWarningPresentedRef.current) return;
    securityWarningDismissingRef.current = true;
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();
  };
  const verifyDomainBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [securityWarningContext, setSecurityWarningContext] =
    useState<SecurityContext>(SecurityContext.SITE);
  // True when the security warning sheet was opened as a gate *before* the
  // request/connection sheet (e.g. unable_to_scan at request-time).  When the
  // user cancels from this gate we must fully reject the pending request, not
  // just dismiss the warning and return to a sheet that was never opened.
  const [securityWarningBlocksSheet, setSecurityWarningBlocksSheet] =
    useState(false);

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

  // Security assessment props for the request bottom sheet:
  // XDR requests → transaction scan, sign_message/sign_auth_entry → no scan (site was scanned at connection)
  const requestIsMalicious =
    !isSignMessageRequest &&
    !isSignAuthEntryRequest &&
    transactionSecurityAssessment.isMalicious;
  const requestIsSuspicious =
    !isSignMessageRequest &&
    !isSignAuthEntryRequest &&
    transactionSecurityAssessment.isSuspicious;
  const requestIsUnableToScan =
    !isSignMessageRequest &&
    !isSignAuthEntryRequest &&
    transactionSecurityAssessment.isUnableToScan;

  const signTransactionDetails = useSignTransactionDetails({ xdr });

  /**
   * Security warnings extracted from scan result
   * @type {SecurityWarning[]}
   */
  const siteSecurityWarnings = useMemo<SecurityWarning[]>(() => {
    if (siteSecurityAssessment.isUnableToScan) {
      // For "Unable to scan" cases, always provide a warning so the list renders
      return [
        {
          id: "unable-to-scan",
          description:
            siteSecurityAssessment.details ||
            t("blockaid.unableToScan.site.description"),
          severity: "warning",
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

  const transactionSecurityWarnings = useMemo<SecurityWarning[]>(() => {
    if (transactionSecurityAssessment.isUnableToScan) {
      // For "Unable to scan" cases, always provide a warning so the list renders
      return [
        {
          id: "unable-to-scan",
          description:
            transactionSecurityAssessment.details ||
            t("securityWarning.unsafeTransaction"),
          severity: "warning",
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
      securityWarningContext === SecurityContext.TRANSACTION
        ? transactionSecurityWarnings
        : siteSecurityWarnings,
    [securityWarningContext, siteSecurityWarnings, transactionSecurityWarnings],
  );

  const getSeverity = useCallback(
    (): Exclude<SecurityLevel, SecurityLevel.SAFE> | undefined =>
      securityWarningContext === SecurityContext.TRANSACTION
        ? transactionSecuritySeverity
        : siteSecuritySeverity,
    [securityWarningContext, siteSecuritySeverity, transactionSecuritySeverity],
  );

  const getProceedAnywayText = useCallback((): string => {
    const isUnableToScan =
      securityWarningContext === SecurityContext.TRANSACTION
        ? transactionSecurityAssessment.level === SecurityLevel.UNABLE_TO_SCAN
        : siteSecurityAssessment.level === SecurityLevel.UNABLE_TO_SCAN;

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
    activeProposalRef.current = null;
    dappConnectionBottomSheetModalRef.current?.dismiss();
    securityWarningDecisionRef.current = true;
    dismissSecurityWarning();
    verifyDomainBottomSheetModalRef.current?.dismiss();
    // Also ensure other sheets are closed to avoid any leftovers
    dappRequestBottomSheetModalRef.current?.dismiss();

    setWalletConnectBusy(false);
    setIsConnecting(false);
    setProposalEvent(null);
    setSiteScanResult(undefined);
    setSecurityWarningContext(SecurityContext.SITE);
    clearEvent();
    if (pendingRequestsQueueRef.current.length)
      setEvent(pendingRequestsQueueRef.current.shift()!);
  };

  /**
   * Clears the dApp request bottom sheet and resets signing state
   * Also rejects the current request to prevent it from reappearing
   * @function handleClearDappRequest
   * @returns {void}
   */
  const handleClearDappRequest = () => {
    if (
      isClearingRequestRef.current ||
      activeRequestRef.current !== requestEvent
    )
      return;
    isClearingRequestRef.current = true;
    dappRequestBottomSheetModalRef.current?.dismiss();
    securityWarningDecisionRef.current = true;
    dismissSecurityWarning();

    // We need to explicitly reject the request here otherwise
    // the app will show the request again on next app launch.
    // Skip if executeDappRequest already sent a response. This fallback
    // fires on BOTH a user dismissal AND the exceptional case where
    // executeDappRequest threw (so the dApp isn't left hanging).
    if (requestEvent && !hasRespondedRef.current) {
      rejectDappRequest({
        sessionRequest: requestEvent,
        message: t("walletKit.userRejected"),
      });
    }

    // Analytics rejection is narrower than the WC fallback: only a genuine user
    // dismissal of a pending request counts. An approved/completed request
    // (hasResponded) or an approve-attempt that threw (approvalInFlight) is not
    // a user reject — resolveDappRejectionEvent encodes exactly that.
    const rejectionEvent = resolveDappRejectionEvent({
      requestMethod: requestMethod as StellarRpcMethods | undefined,
      hasRequestEvent: !!requestEvent,
      hasResponded: hasRespondedRef.current,
      approvalInFlight: approvalInFlightRef.current,
    });
    if (rejectionEvent && requestEvent) {
      const dappDomain = requestEvent.metadata.url || "";
      const payload = dappDomain ? { dappDomain } : {};
      if (rejectionEvent === "message") {
        analytics.trackSignedMessageRejected(payload);
      } else if (rejectionEvent === "auth_entry") {
        analytics.trackSignedAuthEntryRejected(payload);
      } else {
        analytics.trackSignedTransactionRejected(payload);
      }
    }

    setTimeout(() => {
      if (activeRequestRef.current !== requestEvent) return;
      activeRequestRef.current = null;
      setIsSigning(false);
      setRequestEvent(null);
      setTransactionScanResult(undefined);
      setSiteScanResult(undefined);
      setSecurityWarningContext(SecurityContext.SITE);
      setSecurityWarningBlocksSheet(false);
      saveMemo("");
      clearEvent();
      hasRespondedRef.current = false;
      approvalInFlightRef.current = false;

      // Mark processing as complete and process pending request if any
      isProcessingRequestRef.current = false;
      setWalletConnectBusy(false);
      isClearingRequestRef.current = false;
      if (pendingRequestsQueueRef.current.length > 0) {
        logger.debug(
          "WalletKitProvider",
          "Processing pending request after current request completed",
          {
            queueLength: pendingRequestsQueueRef.current.length,
          },
        );
        const pending = pendingRequestsQueueRef.current.shift()!;
        // Trigger the event again to process the pending request
        // pending is already a complete WalletKitSessionRequest with type property
        setEvent(pending);
      }
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

    // Validate that publicKey is not empty before approving session
    if (!publicKey || publicKey.trim().length === 0) {
      logger.error(
        "WalletKitProvider",
        "Cannot approve session with empty publicKey",
        new Error("Empty publicKey in handleDappConnection"),
      );
      showToast({
        title: t("walletKit.connectionNotFound"),
        message: t("walletKit.userNotAuthenticated"),
        variant: "error",
      });
      handleClearDappConnection();
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
    if (
      !requestEvent ||
      approvalInFlightRef.current ||
      isClearingRequestRef.current ||
      !requestEvent.isValid()
    ) {
      return;
    }

    setIsSigning(true);
    // The user committed to approving — mark it so a teardown (including the
    // exceptional approve-threw .catch path) is not miscounted as a user reject.
    approvalInFlightRef.current = true;

    executeDappRequest({
      sessionRequest: requestEvent,
      signTransaction,
      signMessage,
      signAuthEntry,
      networkPassphrase: networkDetails.networkPassphrase,
      publicKey,
      activeChain,
      showToast,
      t,
    })
      .then(() => {
        if (activeRequestRef.current !== requestEvent) return;
        // executeDappRequest handled the WC response internally (success or
        // its own rejection). Mark responded so handleClearDappRequest won't
        // send a duplicate rejection.
        hasRespondedRef.current = true;
      })
      .catch((err: unknown) => {
        // Unexpected throw — leave hasRespondedRef as false so
        // handleClearDappRequest sends the fallback WC rejection.
        logger.error(
          "WalletKitProvider",
          "handleDappRequest unexpected error",
          err,
        );
      })
      .finally(() => {
        if (activeRequestRef.current !== requestEvent) return;
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
      // Opened as an overlay from within an already-open sheet, not as a gate.
      setSecurityWarningBlocksSheet(false);

      // For connection requests, dismiss the main sheet before showing security detail
      // For transaction requests, don't dismiss - it would cancel the request
      if (context === SecurityContext.SITE) {
        dappConnectionBottomSheetModalRef.current?.dismiss();
      }

      presentSecurityWarning();
    },
    [],
  );

  /**
   * Handles proceeding anyway from security warning (context-aware)
   */
  const handleProceedAnyway = (): void => {
    const { job } = useDappApprovalStore.getState();
    if (job?.kind === DappApprovalKind.SITE) {
      if (job.request.isValid())
        job.request
          .respond({ id: job.request.id, jsonrpc: "2.0", result: true })
          .catch((error) => {
            logger.warn(
              "WalletKitProvider",
              "Site approval could not be delivered",
              error,
            );
          });
      else
        rejectDappRequest({
          sessionRequest: job.request,
          message: t("walletKit.userRejected"),
          code: DappErrorCode.CONTEXT_CHANGED,
        });
      securityWarningDecisionRef.current = true;
      dismissSecurityWarning();
      return;
    }
    securityWarningDecisionRef.current = true;
    dismissSecurityWarning();

    const isUnableToScan =
      securityWarningContext === SecurityContext.TRANSACTION
        ? transactionSecurityAssessment.isUnableToScan
        : siteSecurityAssessment.isUnableToScan;

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
  const handleCancelSecurityWarning = () => {
    const { job } = useDappApprovalStore.getState();
    if (job?.kind === DappApprovalKind.SITE) {
      rejectDappRequest({
        sessionRequest: job.request,
        message: t("walletKit.userRejected"),
        code: DappErrorCode.USER_REJECTED,
      });
    }
    securityWarningDecisionRef.current = true;
    dismissSecurityWarning();

    if (
      securityWarningBlocksSheet &&
      securityWarningContext === SecurityContext.TRANSACTION
    ) {
      // Warning was opened as a gate before the request sheet (unable_to_scan path).
      // The request sheet was never shown, so we must fully reject and clean up.
      setSecurityWarningBlocksSheet(false);
      handleClearDappRequest();
    } else {
      setSecurityWarningContext(SecurityContext.SITE);
    }
  };

  /**
   * Handles opening and closing of the Verify Domain bottom sheet
   */
  const handleOpenVerifyDomain = useCallback(() => {
    verifyDomainBottomSheetModalRef.current?.present();
  }, []);

  const handleCloseVerifyDomain = useCallback(() => {
    verifyDomainBottomSheetModalRef.current?.dismiss();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Pre-validation helpers for WalletKit session requests
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validates the message param for sign_message requests.
   * @returns true if valid, false if invalid (rejection already handled)
   */
  const prevalidateSignMessage = (sessionRequest: DappRequest): boolean => {
    const msgParam = (
      sessionRequest.params as
        | { request?: { params?: { message?: unknown } } }
        | undefined
    )?.request?.params?.message;

    // Step 1: Validate content (presence, type, non-empty)
    const contentResult = validateSignMessageContent(msgParam);
    if (!contentResult.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(contentResult.errorKey),
        variant: "error",
      });
      rejectDappRequest({
        sessionRequest,
        message: t(contentResult.errorKey),
      });
      clearEvent();
      resetActiveRequest();
      return false;
    }

    // Step 2: Validate message length (sanity cap; SEP-53 imposes no limit)
    const lengthResult = validateSignMessageLength(contentResult.value);
    if (!lengthResult.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(lengthResult.errorKey),
        variant: "error",
      });
      rejectDappRequest({
        sessionRequest,
        message: t(lengthResult.errorKey),
      });
      clearEvent();
      resetActiveRequest();
      return false;
    }

    return true;
  };

  /**
   * Validates that entryXdr param is present, is a string, and is non-empty.
   * @returns the entryXdr string if valid, or null if invalid (rejection handled)
   */
  const prevalidateSignAuthEntryContent = (
    sessionRequest: DappRequest,
  ): string | null => {
    const entryParam = (
      sessionRequest.params as
        | { request?: { params?: { entryXdr?: unknown } } }
        | undefined
    )?.request?.params?.entryXdr;

    const result = validateSignAuthEntryContent(entryParam);
    if (!result.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(result.errorKey),
        variant: "error",
      });
      rejectDappRequest({
        sessionRequest,
        message: t(result.errorKey),
      });
      clearEvent();
      resetActiveRequest();
      return null;
    }

    return result.value;
  };

  /**
   * Validates that the entryXdr can be parsed as a HashIdPreimage.
   * @returns the parsed preimage if valid, or null if invalid (rejection handled)
   */
  const prevalidateSignAuthEntryXdrFormat = (
    sessionRequest: DappRequest,
    entryXdr: string,
  ): stellarXdr.HashIdPreimage | null => {
    const result = parseAuthEntryPreimage(entryXdr);
    if (!result.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(result.errorKey),
        variant: "error",
      });
      rejectDappRequest({
        sessionRequest,
        message: t(result.errorKey),
      });
      clearEvent();
      resetActiveRequest();
      return null;
    }

    return result.value;
  };

  /**
   * Validates that the networkId in the preimage matches the wallet's active network.
   * Prevents signing auth entries destined for a different network than displayed.
   * @returns true if valid, false if invalid (rejection handled)
   */
  const prevalidateSignAuthEntryNetworkId = (
    sessionRequest: DappRequest,
    preimage: stellarXdr.HashIdPreimage,
  ): boolean => {
    const result = validateAuthEntryNetwork(
      preimage,
      networkDetails.networkPassphrase,
    );
    if (!result.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(result.errorKey),
        variant: "error",
      });
      rejectDappRequest({
        sessionRequest,
        message: t(result.errorKey),
      });
      clearEvent();
      resetActiveRequest();
      return false;
    }

    return true;
  };

  /**
   * Validates that a CAP-71 (ADDRESS_V2) preimage is bound to the active
   * wallet account. Rejects the request on mismatch.
   */
  const prevalidateSignAuthEntryAddress = (
    sessionRequest: DappRequest,
    preimage: stellarXdr.HashIdPreimage,
  ): boolean => {
    const result = validateAuthEntryAddress(preimage, publicKey);
    if (!result.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(result.errorKey),
        variant: "error",
      });
      rejectDappRequest({
        sessionRequest,
        message: t(result.errorKey),
      });
      clearEvent();
      resetActiveRequest();
      return false;
    }

    return true;
  };

  /**
   * Orchestrates all sign_auth_entry pre-validations.
   * @returns true if all validations pass, false if any fail (rejection handled)
   */
  const prevalidateSignAuthEntry = (sessionRequest: DappRequest): boolean => {
    // Step 1: Validate content (presence, type, non-empty)
    const entryXdr = prevalidateSignAuthEntryContent(sessionRequest);
    if (!entryXdr) {
      return false;
    }

    // Step 2: Validate XDR format (can be parsed as HashIdPreimage)
    const preimage = prevalidateSignAuthEntryXdrFormat(
      sessionRequest,
      entryXdr,
    );
    if (!preimage) {
      return false;
    }

    // Step 3: Validate network (networkId matches wallet's active network)
    if (!prevalidateSignAuthEntryNetworkId(sessionRequest, preimage)) {
      return false;
    }

    // Step 4: Validate bound address (CAP-71 ADDRESS_V2) matches active wallet
    if (!prevalidateSignAuthEntryAddress(sessionRequest, preimage)) {
      return false;
    }

    return true;
  };

  /**
   * Handles SESSION_PROPOSAL events — validates auth, scans site, shows connection sheet.
   */
  const handleSessionProposal = (sessionProposal: WalletKitSessionProposal) => {
    if (activeProposalRef.current === sessionProposal.id) return;
    if (
      useDappApprovalStore.getState().job ||
      isProcessingRequestRef.current ||
      isClearingRequestRef.current ||
      activeProposalRef.current !== null
    ) {
      rejectSessionProposal({
        sessionProposal,
        message: t("walletKit.userRejected"),
      });
      clearEvent();
      return;
    }
    setWalletConnectBusy(true);
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

      // Auto-declined because the wallet isn't authenticated — a system block,
      // not a user rejection → dapp_access.blocked (distinct from .rejected).
      analytics.trackGrantAccessBlocked(
        sessionProposal.params.proposer.metadata.url,
        "not_authenticated",
      );

      clearEvent();
      setWalletConnectBusy(false);
      return;
    }

    // Check if wallet is locked
    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
      authStatus === AUTH_STATUS.LOCKED
    ) {
      showToast({
        title: t("walletKit.walletLocked"),
        message: t("walletKit.pleaseUnlockToConnect"),
        variant: "error",
      });
      setWalletConnectBusy(false);
      return;
    }

    activeProposalRef.current = sessionProposal.id;
    setProposalEvent(sessionProposal);

    const dappMetadata = getDappMetadataFromEvent(
      sessionProposal,
      activeSessions,
    );
    const dappDomain = dappMetadata?.url as string;

    scanSite(dappDomain)
      .then((scanResult) => {
        if (activeProposalRef.current !== sessionProposal.id) return;
        setSiteScanResult(scanResult);
        const securityAssessment = assessSiteSecurity(
          scanResult,
          overriddenBlockaidResponse,
        );
        if (securityAssessment.isUnableToScan) {
          setSecurityWarningContext(SecurityContext.SITE);
          presentSecurityWarning();
        } else {
          dappConnectionBottomSheetModalRef.current?.present();
        }
      })
      .catch(() => {
        if (activeProposalRef.current !== sessionProposal.id) return;
        setSiteScanResult(undefined);
        const securityAssessment = assessSiteSecurity(
          undefined,
          overriddenBlockaidResponse,
        );
        if (securityAssessment.isUnableToScan) {
          setSecurityWarningContext(SecurityContext.SITE);
          presentSecurityWarning();
        } else {
          dappConnectionBottomSheetModalRef.current?.present();
        }
      });
  };

  /**
   * Entry point shared by both transports once a request is native-verified:
   * pins it as the active request, validates method and params, runs the
   * Blockaid transaction scan for XDR requests, and presents the signing
   * sheet. Everything downstream (approve/reject) reads `activeRequestRef`.
   */
  const handleNormalizedRequest = (incoming: DappRequest) => {
    const sessionRequest: DappRequest = {
      ...incoming,
      isValid: () =>
        activeRequestRef.current === sessionRequest &&
        !isClearingRequestRef.current &&
        incoming.isValid(),
    };
    activeRequestRef.current = sessionRequest;
    if (!sessionRequest.isValid()) {
      rejectDappRequest({
        sessionRequest,
        message: t("walletKit.userNotAuthenticated"),
        code: DappErrorCode.CONTEXT_CHANGED,
      });
      resetActiveRequest();
      return;
    }
    const { method } = sessionRequest.params.request;
    const { params } = sessionRequest.params.request;
    const supported = Object.values(StellarRpcMethods).includes(
      method as StellarRpcMethods,
    );
    const transactionMethod =
      method === (StellarRpcMethods.SIGN_XDR as string) ||
      method === (StellarRpcMethods.SIGN_AND_SUBMIT_XDR as string);
    if (
      !supported ||
      (transactionMethod &&
        (typeof params?.xdr !== "string" || !params.xdr.trim()))
    ) {
      rejectDappRequest({
        sessionRequest,
        message: t("walletKit.invalidRequestTitle"),
        code: !supported
          ? DappErrorCode.UNSUPPORTED_METHOD
          : DappErrorCode.INVALID_PARAMS,
      });
      resetActiveRequest();
      return;
    }
    // Get dApp metadata
    const dappDomain = sessionRequest.origin;

    const requestParams = sessionRequest.params as
      | { request?: { method?: string; params?: { xdr?: string } } }
      | undefined;
    const currentRequestMethod = requestParams?.request?.method;
    const requestXdr = requestParams?.request?.params?.xdr;

    const isXdrRequest =
      currentRequestMethod === (StellarRpcMethods.SIGN_XDR as string) ||
      currentRequestMethod ===
        (StellarRpcMethods.SIGN_AND_SUBMIT_XDR as string);

    if (isXdrRequest && requestXdr) {
      let isSep10Challenge = false;
      try {
        const parsed = TransactionBuilder.fromXdr(
          requestXdr,
          networkDetails.networkPassphrase,
        );
        isSep10Challenge =
          parsed instanceof Transaction &&
          parsed.sequence === "0" &&
          parsed.operations.length > 0 &&
          parsed.operations.every((op) => op.type === "manageData");
      } catch {
        rejectDappRequest({
          sessionRequest,
          message: t("walletKit.invalidRequestTitle"),
          code: DappErrorCode.INVALID_PARAMS,
        });
        resetActiveRequest();
        return;
      }
      setRequestEvent(sessionRequest);
      if (isSep10Challenge) {
        // A SEP-10 challenge cannot be submitted (sequence 0); scanning it only
        // adds a network round trip and, when Blockaid is unreachable, a
        // second warning gate before the login signature.
        dappRequestBottomSheetModalRef.current?.present();
        return;
      }
      // XDR-based requests: scan transaction first
      scanTransaction(requestXdr, dappDomain)
        .then((scanResult) => {
          if (!sessionRequest.isValid()) return;
          setTransactionScanResult(scanResult);
          const securityAssessment = assessTransactionSecurity(
            scanResult,
            overriddenBlockaidResponse,
          );
          if (securityAssessment.isUnableToScan) {
            setSecurityWarningContext(SecurityContext.TRANSACTION);
            setSecurityWarningBlocksSheet(true);
            presentSecurityWarning();
          } else {
            dappRequestBottomSheetModalRef.current?.present();
          }
        })
        .catch(() => {
          if (!sessionRequest.isValid()) return;
          setTransactionScanResult(undefined);
          const securityAssessment = assessTransactionSecurity(
            undefined,
            overriddenBlockaidResponse,
          );
          if (securityAssessment.isUnableToScan) {
            setSecurityWarningContext(SecurityContext.TRANSACTION);
            setSecurityWarningBlocksSheet(true);
            presentSecurityWarning();
          } else {
            dappRequestBottomSheetModalRef.current?.present();
          }
        });
    } else {
      // Non-XDR requests (sign_message, sign_auth_entry): validate params first
      if (currentRequestMethod === (StellarRpcMethods.SIGN_MESSAGE as string)) {
        if (!prevalidateSignMessage(sessionRequest)) return;
      }

      if (
        currentRequestMethod === (StellarRpcMethods.SIGN_AUTH_ENTRY as string)
      ) {
        if (!prevalidateSignAuthEntry(sessionRequest)) return;
      }

      setRequestEvent(sessionRequest);
      dappRequestBottomSheetModalRef.current?.present();
    }
  };

  /**
   * Handles SESSION_REQUEST events — validates auth/session/origin, pre-validates
   * request params, scans transactions, and shows the appropriate sheet.
   */
  const handleSessionRequest = (sessionRequest: WalletKitSessionRequest) => {
    // Simple queue: if already processing a request, store this one as pending
    if (
      isProcessingRequestRef.current ||
      activeProposalRef.current !== null ||
      isClearingRequestRef.current ||
      useDappApprovalStore.getState().job
    ) {
      // Normal queue flow, not an error condition.
      logger.info(
        "WalletKitProvider",
        "Request already in progress, queuing new request",
        {
          currentRequestId: requestEvent?.id,
          newRequestId: sessionRequest.id,
          queueLength: pendingRequestsQueueRef.current.length + 1,
        },
      );
      pendingRequestsQueueRef.current.push(sessionRequest);
      clearEvent();
      return;
    }

    // Mark as processing
    isProcessingRequestRef.current = true;
    setWalletConnectBusy(true);

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
      isProcessingRequestRef.current = false;
      setWalletConnectBusy(false);
      return;
    }

    // Check if wallet is locked
    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
      authStatus === AUTH_STATUS.LOCKED
    ) {
      showToast({
        title: t("walletKit.walletLocked"),
        message: t("walletKit.pleaseUnlockToSignTransaction"),
        variant: "error",
      });
      isProcessingRequestRef.current = false;
      setWalletConnectBusy(false);
      return;
    }

    // Wait for active sessions to be fetched
    if (Object.keys(activeSessions).length === 0) {
      isProcessingRequestRef.current = false;
      setWalletConnectBusy(false);
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
      isProcessingRequestRef.current = false;
      setWalletConnectBusy(false);
      return;
    }

    // Validate transaction request origin
    const transactionRequestOrigin =
      sessionRequest.verifyContext?.verified?.origin;

    const isValidTransactionRequestOrigin =
      isE2ETest ||
      Object.values(activeSessions).some((session) => {
        const sessionHostname = getHostname(session.peer?.metadata?.url);
        const requestHostname = getHostname(transactionRequestOrigin);

        if (!sessionHostname || !requestHostname) {
          return false;
        }

        return sessionHostname === requestHostname;
      });

    if (!isValidTransactionRequestOrigin) {
      showToast({
        title: t("walletKit.invalidTransactionOrigin"),
        message: t("walletKit.invalidTransactionOriginMessage", {
          transactionRequestOrigin,
        }),
        variant: "error",
      });

      // The exact-hostname comparison above produces false positives
      // on legitimate subdomain drift — every flagged origin
      // inspected so far has been a legitimate dApp or developer
      // environment. The factual message + the
      // transactionRequestOrigin arg below are enough to triage which
      // dApp tripped the check.
      logger.error(
        "WalletKitProvider",
        "Invalid transaction origin",
        new Error(
          "WalletConnect transaction request origin does not match any active session hostname",
        ),
        { transactionRequestOrigin },
      );

      rejectSessionRequest({
        sessionRequest,
        message: `${t("walletKit.invalidTransactionOrigin")}: ${transactionRequestOrigin}.`,
      });

      clearEvent();
      isProcessingRequestRef.current = false;
      setWalletConnectBusy(false);
      return;
    }

    handleNormalizedRequest(
      toDappRequest(
        sessionRequest,
        publicKey,
        networkDetails.networkPassphrase,
      ),
    );
  };

  useEffect(() => {
    if (!webviewJob) {
      if (handledWebviewJobRef.current) {
        handledWebviewJobRef.current = null;
        securityWarningDecisionRef.current = true;
        dismissSecurityWarning();
        if (requestEvent?.transport === DappTransport.WEBVIEW) {
          hasRespondedRef.current = true;
          handleClearDappRequest();
        } else if (pendingRequestsQueueRef.current.length) {
          setEvent(pendingRequestsQueueRef.current.shift()!);
        }
      }
      return;
    }
    if (handledWebviewJobRef.current === webviewJob.request) return;
    handledWebviewJobRef.current = webviewJob.request;
    const { request, kind } = webviewJob;
    if (kind === DappApprovalKind.SIGN) {
      handleNormalizedRequest(request);
      return;
    }
    scanSite(request.origin)
      .then((result) => {
        if (!request.isValid()) return;
        setSiteScanResult(result);
        const assessment = assessSiteSecurity(
          result,
          overriddenBlockaidResponse,
        );
        if (
          !assessment.isMalicious &&
          !assessment.isSuspicious &&
          !assessment.isUnableToScan
        ) {
          request
            .respond({ id: request.id, jsonrpc: "2.0", result: true })
            .catch((error) => {
              logger.warn(
                "WalletKitProvider",
                "Site approval could not be delivered",
                error,
              );
            });
          return;
        }
        setSecurityWarningContext(SecurityContext.SITE);
        presentSecurityWarning();
      })
      .catch(() => {
        if (!request.isValid()) return;
        setSiteScanResult(undefined);
        setSecurityWarningContext(SecurityContext.SITE);
        presentSecurityWarning();
      });
    // Job identity is immutable; account/navigation changes invalidate it upstream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webviewJob]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Main WalletKit event handler effect
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Effect that dispatches WalletKit events to their respective handlers.
   */
  useEffect(() => {
    if (event.type === WalletKitEventTypes.SESSION_PROPOSAL) {
      handleSessionProposal(event as WalletKitSessionProposal);
    }

    if (event.type === WalletKitEventTypes.SESSION_REQUEST) {
      handleSessionRequest(event as WalletKitSessionRequest);
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
            isMalicious={siteSecurityAssessment.isMalicious}
            isSuspicious={siteSecurityAssessment.isSuspicious}
            isUnableToScan={siteSecurityAssessment.isUnableToScan}
            securityWarningAction={() =>
              presentSecurityWarningDetail(SecurityContext.SITE)
            }
            onVerifyDomainPress={handleOpenVerifyDomain}
          />
        }
      />

      {/* Bottom sheet for dApp transaction requests.

          sign_message and sign_auth_entry render the payload in a capped,
          inner-scrolling box. The sheet wraps its content in a pan gesture and
          on Android that pan cancels the nested ScrollView's scroll, so
          dragging the payload moves the whole sheet instead of scrolling the
          text. Disabling the content pan for those requests leaves the drag
          handle (and the Cancel button) to dismiss the sheet. */}
      <BottomSheet
        modalRef={dappRequestBottomSheetModalRef}
        handleCloseModal={handleClearDappRequest}
        analyticsEvent={AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION}
        enableContentPanningGesture={!isNonTransactionRequest}
        bottomSheetModalProps={{
          onDismiss: handleClearDappRequest,
          enableDynamicSizing: true,
        }}
        customContent={
          <DappRequestBottomSheetContent
            account={account}
            requestEvent={requestEvent}
            networkDetails={networkDetails}
            isSigning={isSigning}
            isValidatingMemo={isValidatingMemo}
            onBannerPress={onOpenAddMemoExplanationBottomSheet}
            onConfirm={handleDappRequest}
            onCancelRequest={handleClearDappRequest}
            isMalicious={requestIsMalicious}
            isSuspicious={requestIsSuspicious}
            isUnableToScan={requestIsUnableToScan}
            transactionScanResult={
              isNonTransactionRequest ? undefined : transactionScanResult
            }
            securityWarningAction={() =>
              presentSecurityWarningDetail(SecurityContext.TRANSACTION)
            }
            signTransactionDetails={signTransactionDetails}
            isMemoMissing={isMemoMissing}
          />
        }
      />

      {/* Bottom sheet for explaining why a memo is required for a dApp transaction request */}
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
        bottomSheetModalProps={{
          onDismiss: () => {
            securityWarningPresentedRef.current = false;
            securityWarningDismissingRef.current = false;
            const decided = securityWarningDecisionRef.current;
            securityWarningDecisionRef.current = false;
            if (securityWarningPendingPresentRef.current) {
              securityWarningPendingPresentRef.current = false;
              presentSecurityWarning();
              return;
            }
            if (!decided) handleCancelSecurityWarning();
          },
        }}
        customContent={
          <SecurityDetailBottomSheet
            warnings={getWarnings()}
            origin={webviewJob?.request.origin}
            onCancel={handleCancelSecurityWarning}
            onProceedAnyway={handleProceedAnyway}
            onClose={handleCancelSecurityWarning}
            securityContext={securityWarningContext}
            severity={getSeverity()}
            proceedAnywayText={getProceedAnywayText()}
          />
        }
      />

      {/* Bottom sheet for explaining why a domain should be verified for a dApp connection request */}
      <BottomSheet
        modalRef={verifyDomainBottomSheetModalRef}
        handleCloseModal={handleCloseVerifyDomain}
        customContent={
          <InformationBottomSheet
            title={t("dappConnectionBottomSheetContent.verifyDomainTitle")}
            texts={[
              {
                key: "verify-domain-description",
                value: t(
                  "dappConnectionBottomSheetContent.verifyDomainDescription",
                ),
              },
            ]}
            headerElement={
              <View className="p-2 rounded-[8px] bg-background-tertiary">
                <Icon.InfoCircle color={themeColors.foreground.primary} />
              </View>
            }
            onClose={handleCloseVerifyDomain}
            onConfirm={handleCloseVerifyDomain}
            confirmLabel={t(
              "dappConnectionBottomSheetContent.verifyDomainButton",
            )}
          />
        }
      />
      {children}
    </View>
  );
};
