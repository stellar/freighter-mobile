import { WalletKitTypes } from "@reown/walletkit";
import { getSdkError } from "@walletconnect/utils";
import { logger } from "config/logger";
import {
  useWalletKitStore,
  WALLET_KIT_MT_REDIRECT_NATIVE,
  WalletKitEventTypes,
} from "ducks/walletKit";
import { walletKit } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback, useEffect } from "react";
import { Linking } from "react-native";

/**
 * Hook for managing WalletKit events.
 * Sets up event listeners for session proposals, requests, and deletions.
 *
 * @param {boolean} initialized - Whether WalletKit has been initialized
 *
 * @example
 * ```tsx
 * const initialized = useWalletKitInitialize();
 * useWalletKitEventsManager(initialized);
 * ```
 */
export const useWalletKitEventsManager = (initialized: boolean) => {
  const { setEvent, fetchActiveSessions } = useWalletKitStore();
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  const onSessionProposal = useCallback(
    (args: WalletKitTypes.SessionProposal) => {
      logger.debug("WalletKit", "onSessionProposal: ", args);

      setEvent({
        type: WalletKitEventTypes.SESSION_PROPOSAL,
        ...args,
      });
    },
    [setEvent],
  );

  const onSessionRequest = useCallback(
    (args: WalletKitTypes.SessionRequest) => {
      logger.debug("WalletKit", "onSessionRequest: ", args);

      setEvent({
        type: WalletKitEventTypes.SESSION_REQUEST,
        ...args,
      });
    },
    [setEvent],
  );

  const onSessionDelete = useCallback(
    (args: WalletKitTypes.SessionDelete) => {
      logger.debug("WalletKit", "onSessionDelete: ", args);

      walletKit
        .disconnectSession({
          topic: args.topic,
          reason: getSdkError("USER_DISCONNECTED"),
        })
        .finally(() => {
          fetchActiveSessions();
        });
    },
    [fetchActiveSessions],
  );

  const onDeepLink = useCallback(
    (event: { url: string | null }): void => {
      // Early return if the deep link is not compliant with the expected format
      if (!event.url?.includes(WALLET_KIT_MT_REDIRECT_NATIVE)) {
        return;
      }

      const urlWithParams = new URL(event.url);
      const uriParam = urlWithParams.search.split("uri=")[1];

      // Early return if the URI param is not found
      if (!uriParam) {
        showToast({
          title: t("walletKit.errorPairing"),
          message: t("common.error", {
            errorMessage: t("walletKit.errorNoUriParam"),
          }),
          variant: "error",
        });
        return;
      }

      // Try pairing with the dApp using the provided URI param
      walletKit.pair({ uri: decodeURIComponent(uriParam) }).catch((error) => {
        showToast({
          title: t("walletKit.errorPairing"),
          message: t("common.error", {
            errorMessage:
              error instanceof Error ? error.message : t("common.unknownError"),
          }),
          variant: "error",
        });
      });
    },
    [t, showToast],
  );

  useEffect(() => {
    let deepLinkSubscription:
      | ReturnType<typeof Linking.addEventListener>
      | undefined;

    if (initialized) {
      // Start listening for WalletKit events
      walletKit.on("session_proposal", onSessionProposal);
      walletKit.on("session_request", onSessionRequest);
      walletKit.on("session_delete", onSessionDelete);

      // Fetch all active sessions
      fetchActiveSessions();

      // Handle deep links when app is already running
      deepLinkSubscription = Linking.addEventListener("url", onDeepLink);

      // Handle deep links when app is opened from a quit state
      Linking.getInitialURL().then((url) => onDeepLink({ url }));
    }

    return () => {
      deepLinkSubscription?.remove();
    };
  }, [
    initialized,
    onSessionProposal,
    onSessionRequest,
    onSessionDelete,
    onDeepLink,
    fetchActiveSessions,
  ]);
};
