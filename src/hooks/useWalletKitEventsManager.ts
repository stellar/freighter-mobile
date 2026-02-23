import { WalletKitTypes } from "@reown/walletkit";
import { getSdkError } from "@walletconnect/utils";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import {
  useWalletKitStore,
  WALLET_KIT_MT_REDIRECT_NATIVE,
  WalletKitEventTypes,
} from "ducks/walletKit";
import { walletKit } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
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
  const { network } = useAuthenticationStore();
  const { account } = useGetActiveAccount();
  const { setEvent, fetchActiveSessions } = useWalletKitStore();
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  const publicKey = account?.publicKey || "";

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
          // Since this is happening asynchronously inside an event listener we
          // need to get account and network directly from the store to make
          // sure we're not using stale data
          const { account: storeAccount, network: storeNetwork } =
            useAuthenticationStore.getState();
          fetchActiveSessions(storeAccount?.publicKey || "", storeNetwork);
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

      // Handle deep links when app is already running
      deepLinkSubscription = Linking.addEventListener("url", onDeepLink);

      // Handle deep links when app is opened from a quit state
      Linking.getInitialURL().then((url) => onDeepLink({ url }));
    }

    return () => {
      // Clean up event listeners to prevent memory leaks
      if (initialized) {
        walletKit.off("session_proposal", onSessionProposal);
        walletKit.off("session_request", onSessionRequest);
        walletKit.off("session_delete", onSessionDelete);
      }
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

  useEffect(() => {
    // Automatically fetch active sessions when the component mounts or
    // when the public key or network changes
    if (initialized && publicKey !== undefined) {
      fetchActiveSessions(publicKey, network);
    }
  }, [initialized, network, publicKey, fetchActiveSessions]);
};
