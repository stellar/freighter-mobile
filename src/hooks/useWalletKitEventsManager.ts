import { WalletKitTypes } from "@reown/walletkit";
import { getSdkError } from "@walletconnect/utils";
import { logger } from "config/logger";
import { useWalletKitStore, WalletKitEventTypes } from "ducks/walletKit";
import { walletKit } from "helpers/walletKitUtil";
import {useCallback, useEffect } from "react";

export const useWalletKitEventsManager = (initialized: boolean) => {
  const { setEvent, fetchActiveSessions } = useWalletKitStore();

  const onSessionProposal = useCallback((args: WalletKitTypes.SessionProposal) => {
    logger.debug("WalletKit", "onSessionProposal: ", args);
    
    setEvent({
      type: WalletKitEventTypes.SESSION_PROPOSAL,
      ...args,
    });
  }, [setEvent]);

  const onSessionRequest = useCallback((args: WalletKitTypes.SessionRequest) => {  
    logger.debug("WalletKit", "onSessionRequest: ", args);

    setEvent({
      type: WalletKitEventTypes.SESSION_REQUEST,
      ...args,
    });
  }, [setEvent]);

  const onSessionDelete = useCallback((args: WalletKitTypes.SessionDelete) => {
    logger.debug("WalletKit", "onSessionDelete: ", args);

    walletKit.disconnectSession({
      topic: args.topic,
      reason: getSdkError("USER_DISCONNECTED"),
    }).finally(() => {
      fetchActiveSessions();
    });
  }, [fetchActiveSessions]);


  /** ****************************************************************************
   * Set up WalletKit event listeners
   **************************************************************************** */
  useEffect(() => {
    if (initialized) {
      walletKit.on("session_proposal", onSessionProposal);
      walletKit.on("session_request", onSessionRequest);
      walletKit.on("session_delete", onSessionDelete);

      fetchActiveSessions();
    }
  }, [initialized, onSessionProposal, onSessionRequest, onSessionDelete, fetchActiveSessions]);
}

/*
// Updating a Session
// The session_update event is emitted from the wallet when the session is updated by calling updateSession.
// To update a session, pass in the topic and the new namespace.
// await walletKit.updateSession({ topic, namespaces: newNs });

// Extending a Session
// To extend the session, call the extendSession method and pass in the new topic.
// The session_update event will be emitted from the wallet.
// await walletKit.extendSession({ topic });

// TODO: emit session events on account and chain (network) changes
// Emitting Session Events
// To emit session events, call the emitSessionEvent and pass in the params.
// If you wish to switch to chain/account that is not approved (missing from session.namespaces)
// you will have to update the session first. In the following example, the wallet will emit session_event
// that will instruct the dapp to switch the active accounts.
// await walletKit.emitSessionEvent({
//   topic,
//   event: {
//     name: "accountsChanged",
//     data: ["0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb"],
//   },
//   chainId: "eip155:1",
// });
// In the following example, the wallet will emit session_event when the wallet switches chains.
// await walletKit.emitSessionEvent({
//   topic,
//   event: {
//     name: "chainChanged",
//     data: 1,
//   },
//   chainId: "eip155:1",
// });
*/