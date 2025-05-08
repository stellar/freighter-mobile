import { WalletKitTypes } from "@reown/walletkit";
import { getSdkError } from "@walletconnect/utils";
import { logger } from "config/logger";
import { useWalletKitStore, WalletKitEventTypes } from "ducks/walletKit";
import { walletKit } from "helpers/walletKitUtil";
import { useCallback, useEffect } from "react";

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

  useEffect(() => {
    if (initialized) {
      walletKit.on("session_proposal", onSessionProposal);
      walletKit.on("session_request", onSessionRequest);
      walletKit.on("session_delete", onSessionDelete);

      fetchActiveSessions();
    }
  }, [
    initialized,
    onSessionProposal,
    onSessionRequest,
    onSessionDelete,
    fetchActiveSessions,
  ]);
};
