import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { xdr as stellarXdr } from "@stellar/stellar-sdk";
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
  StellarRpcMethods,
  StellarSignXDRParams,
} from "ducks/walletKit";
import { isE2ETest } from "helpers/isEnv";
import { getHostname } from "helpers/protocols";
import {
  approveSessionProposal,
  approveSessionRequest,
  rejectSessionRequest,
  rejectSessionProposal,
} from "helpers/walletKitUtil";
import {
  validateSignMessageContent,
  validateSignMessageLength,
  validateSignAuthEntryContent,
  parseAuthEntryPreimage,
  validateAuthEntryNetwork,
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
  const [requestEvent, setRequestEvent] =
    useState<WalletKitSessionRequest | null>(null);
  const [siteScanResult, setSiteScanResult] = useState<
    Blockaid.SiteScanResponse | undefined
  >(undefined);
  const [transactionScanResult, setTransactionScanResult] = useState<
    Blockaid.StellarTransactionScanResponse | undefined
  >(undefined);

  // Request queue to prevent concurrent request handling race conditions
  const isProcessingRequestRef = useRef(false);
  const pendingRequestsQueueRef = useRef<WalletKitSessionRequest[]>([]);
  // Guard against double-reject: set to true once approveSessionRequest has sent
  // its own response (success or handled error) so handleClearDappRequest doesn't
  // send a duplicate rejection when it fires via .finally().
  const hasRespondedRef = useRef(false);

  const xdr = useMemo(
    () =>
      (requestEvent?.params.request.params as StellarSignXDRParams)?.xdr ?? "",
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
    dappConnectionBottomSheetModalRef.current?.dismiss();
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();
    verifyDomainBottomSheetModalRef.current?.dismiss();
    // Also ensure other sheets are closed to avoid any leftovers
    dappRequestBottomSheetModalRef.current?.dismiss();

    setIsConnecting(false);
    setProposalEvent(null);
    setSiteScanResult(undefined);
    setSecurityWarningContext(SecurityContext.SITE);
    clearEvent();
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
    // the app will show the request again on next app launch.
    // Skip if approveSessionRequest already sent a response.
    if (requestEvent && !hasRespondedRef.current) {
      rejectSessionRequest({
        sessionRequest: requestEvent,
        message: t("walletKit.userRejected"),
      });
    }

    setTimeout(() => {
      setIsSigning(false);
      setRequestEvent(null);
      setTransactionScanResult(undefined);
      setSiteScanResult(undefined);
      setSecurityWarningContext(SecurityContext.SITE);
      setSecurityWarningBlocksSheet(false);
      saveMemo("");
      clearEvent();
      hasRespondedRef.current = false;

      // Mark processing as complete and process pending request if any
      isProcessingRequestRef.current = false;
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
    if (!requestEvent) {
      return;
    }

    setIsSigning(true);

    approveSessionRequest({
      sessionRequest: requestEvent,
      signTransaction,
      signMessage,
      signAuthEntry,
      networkPassphrase: networkDetails.networkPassphrase,
      activeChain,
      showToast,
      t,
    })
      .then(() => {
        // approveSessionRequest handled the WC response internally (success or
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
    siteSecurityWarningBottomSheetModalRef.current?.dismiss();

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
  const prevalidateSignMessage = (
    sessionRequest: WalletKitSessionRequest,
  ): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const msgParam = (
      sessionRequest.params.request.params as { message?: unknown }
    ).message;

    // Step 1: Validate content (presence, type, non-empty)
    const contentResult = validateSignMessageContent(msgParam);
    if (!contentResult.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(contentResult.errorKey),
        variant: "error",
      });
      rejectSessionRequest({
        sessionRequest,
        message: t(contentResult.errorKey),
      });
      clearEvent();
      isProcessingRequestRef.current = false;
      return false;
    }

    // Step 2: Validate message length (1KB limit per SEP-53)
    const lengthResult = validateSignMessageLength(contentResult.value);
    if (!lengthResult.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(lengthResult.errorKey),
        variant: "error",
      });
      rejectSessionRequest({
        sessionRequest,
        message: t(lengthResult.errorKey),
      });
      clearEvent();
      isProcessingRequestRef.current = false;
      return false;
    }

    return true;
  };

  /**
   * Validates that entryXdr param is present, is a string, and is non-empty.
   * @returns the entryXdr string if valid, or null if invalid (rejection handled)
   */
  const prevalidateSignAuthEntryContent = (
    sessionRequest: WalletKitSessionRequest,
  ): string | null => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const entryParam = (
      sessionRequest.params.request.params as { entryXdr?: unknown }
    ).entryXdr;

    const result = validateSignAuthEntryContent(entryParam);
    if (!result.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(result.errorKey),
        variant: "error",
      });
      rejectSessionRequest({
        sessionRequest,
        message: t(result.errorKey),
      });
      clearEvent();
      isProcessingRequestRef.current = false;
      return null;
    }

    return result.value;
  };

  /**
   * Validates that the entryXdr can be parsed as a HashIdPreimage.
   * @returns the parsed preimage if valid, or null if invalid (rejection handled)
   */
  const prevalidateSignAuthEntryXdrFormat = (
    sessionRequest: WalletKitSessionRequest,
    entryXdr: string,
  ): stellarXdr.HashIdPreimage | null => {
    const result = parseAuthEntryPreimage(entryXdr);
    if (!result.valid) {
      showToast({
        title: t("walletKit.invalidRequestTitle"),
        message: t(result.errorKey),
        variant: "error",
      });
      rejectSessionRequest({
        sessionRequest,
        message: t(result.errorKey),
      });
      clearEvent();
      isProcessingRequestRef.current = false;
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
    sessionRequest: WalletKitSessionRequest,
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
      rejectSessionRequest({
        sessionRequest,
        message: t(result.errorKey),
      });
      clearEvent();
      isProcessingRequestRef.current = false;
      return false;
    }

    return true;
  };

  /**
   * Orchestrates all sign_auth_entry pre-validations.
   * @returns true if all validations pass, false if any fail (rejection handled)
   */
  const prevalidateSignAuthEntry = (
    sessionRequest: WalletKitSessionRequest,
  ): boolean => {
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

    return true;
  };

  /**
   * Handles SESSION_PROPOSAL events — validates auth, scans site, shows connection sheet.
   */
  const handleSessionProposal = (sessionProposal: WalletKitSessionProposal) => {
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
    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
      authStatus === AUTH_STATUS.LOCKED
    ) {
      showToast({
        title: t("walletKit.walletLocked"),
        message: t("walletKit.pleaseUnlockToConnect"),
        variant: "error",
      });
      return;
    }

    setProposalEvent(sessionProposal);

    const dappMetadata = getDappMetadataFromEvent(
      sessionProposal,
      activeSessions,
    );
    const dappDomain = dappMetadata?.url as string;

    scanSite(dappDomain)
      .then((scanResult) => {
        setSiteScanResult(scanResult);
        const securityAssessment = assessSiteSecurity(
          scanResult,
          overriddenBlockaidResponse,
        );
        if (securityAssessment.isUnableToScan) {
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
  };

  /**
   * Handles SESSION_REQUEST events — validates auth/session/origin, pre-validates
   * request params, scans transactions, and shows the appropriate sheet.
   */
  const handleSessionRequest = (sessionRequest: WalletKitSessionRequest) => {
    // Simple queue: if already processing a request, store this one as pending
    if (isProcessingRequestRef.current) {
      logger.warn(
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
      return;
    }

    // Wait for active sessions to be fetched
    if (Object.keys(activeSessions).length === 0) {
      isProcessingRequestRef.current = false;
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

      logger.error(
        "WalletKitProvider",
        "Invalid transaction origin",
        new Error(
          "Untrusted Transaction Domain. Bad actor potentially found in transaction request.",
        ),
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
      isProcessingRequestRef.current = false;
      return;
    }

    setRequestEvent(sessionRequest);

    // Get dApp metadata
    const dappMetadata = getDappMetadataFromEvent(
      sessionRequest,
      activeSessions,
    );
    const dappDomain =
      (dappMetadata?.url as string) ||
      sessionRequest.verifyContext?.verified?.origin ||
      "";

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const currentRequestMethod = sessionRequest.params.request.method;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const requestXdr = sessionRequest.params.request.params.xdr as string;

    const isXdrRequest =
      currentRequestMethod === (StellarRpcMethods.SIGN_XDR as string) ||
      currentRequestMethod ===
        (StellarRpcMethods.SIGN_AND_SUBMIT_XDR as string);

    if (isXdrRequest && requestXdr) {
      // XDR-based requests: scan transaction first
      scanTransaction(requestXdr, dappDomain)
        .then((scanResult) => {
          setTransactionScanResult(scanResult);
          const securityAssessment = assessTransactionSecurity(
            scanResult,
            overriddenBlockaidResponse,
          );
          if (securityAssessment.isUnableToScan) {
            setSecurityWarningContext(SecurityContext.TRANSACTION);
            setSecurityWarningBlocksSheet(true);
            siteSecurityWarningBottomSheetModalRef.current?.present();
          } else {
            dappRequestBottomSheetModalRef.current?.present();
          }
        })
        .catch(() => {
          setTransactionScanResult(undefined);
          const securityAssessment = assessTransactionSecurity(
            undefined,
            overriddenBlockaidResponse,
          );
          if (securityAssessment.isUnableToScan) {
            setSecurityWarningContext(SecurityContext.TRANSACTION);
            setSecurityWarningBlocksSheet(true);
            siteSecurityWarningBottomSheetModalRef.current?.present();
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

      dappRequestBottomSheetModalRef.current?.present();
    }
  };

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

      {/* Bottom sheet for dApp transaction requests */}
      <BottomSheet
        modalRef={dappRequestBottomSheetModalRef}
        handleCloseModal={handleClearDappRequest}
        analyticsEvent={AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION}
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
