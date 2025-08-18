import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import DappConnectionBottomSheetContent from "components/screens/WalletKit/DappConnectionBottomSheetContent";
import DappRequestBottomSheetContent from "components/screens/WalletKit/DappRequestBottomSheetContent";
import Icon from "components/sds/Icon";
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
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessSiteSecurity,
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
  const { themeColors } = useColors();

  const addMemoExplanationBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const publicKey = account?.publicKey || "";

  const initialized = useWalletKitInitialize();
  useWalletKitEventsManager(initialized);

  const { event, clearEvent, activeSessions, fetchActiveSessions } =
    useWalletKitStore();
  const { showToast } = useToast();
  const { t } = useAppTranslation();
  const { scanSite } = useBlockaidSite();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [proposalEvent, setProposalEvent] =
    useState<WalletKitSessionProposal | null>(null);
  const [requestEvent, setRequestEvent] =
    useState<WalletKitSessionRequest | null>(null);
  const [siteScanResult, setSiteScanResult] = useState<
    Blockaid.SiteScanResponse | undefined
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
   * Security warnings extracted from scan result
   * @type {SecurityWarning[]}
   */
  const securityWarnings = useMemo(() => {
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
  const securitySeverity = useMemo(() => {
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

      const dappUrl = sessionProposal.params.proposer.metadata.url;

      scanSite(dappUrl)
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

      setRequestEvent(sessionRequest);
      dappRequestBottomSheetModalRef.current?.present();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessions, event.type, authStatus]);

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
            securityWarningAction={presentSecurityWarningDetail}
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
            isMemoMissing={isMemoMissing}
          />
        }
      />

      <BottomSheet
        modalRef={addMemoExplanationBottomSheetModalRef}
        handleCloseModal={onCancelAddMemo}
        customContent={
          <InformationBottomSheet
            headerElement={
              <View className="bg-red-3 p-2 rounded-[8px]">
                <Icon.InfoOctagon
                  color={themeColors.status.error}
                  size={28}
                  withBackground
                />
              </View>
            }
            onClose={onCancelAddMemo}
            title={t("addMemoExplanationBottomSheet.title")}
            texts={[
              {
                key: "description",
                value: t("addMemoExplanationBottomSheet.description"),
              },
              {
                key: "disabledWarning",
                value: t("addMemoExplanationBottomSheet.disabledWarning"),
              },
              {
                key: "checkMemoRequirements",
                value: t("addMemoExplanationBottomSheet.checkMemoRequirements"),
              },
            ]}
          />
        }
      />

      {/* Bottom sheet for site security warnings */}
      <BottomSheet
        modalRef={siteSecurityWarningBottomSheetModalRef}
        handleCloseModal={handleCancelSecurityWarning}
        customContent={
          <SecurityDetailBottomSheet
            warnings={securityWarnings}
            onCancel={handleCancelSecurityWarning}
            onProceedAnyway={handleProceedAnyway}
            onClose={handleCancelSecurityWarning}
            severity={securitySeverity}
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
