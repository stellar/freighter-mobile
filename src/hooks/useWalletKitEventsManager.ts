import {useCallback, useEffect} from 'react';
import { WalletKitTypes } from "@reown/walletkit";
import { buildApprovedNamespaces, getSdkError, SdkErrorKey } from '@walletconnect/utils'
import { walletKit } from 'helpers/walletKitUtil';
import { logger } from 'config/logger';

// TODO: get address from wallet
// This is Cassio's main address on Freighter for both testnet and pubnet
const address = "GDAFOKARX4VPZHPDBY5UTIRK32GUGCC7PQJ4SGQYGOEYNV2XSE5TY4KE";

export default function useWalletKitEventsManager(initialized: boolean) {

  const onSessionProposal = useCallback(async ({ id, params }: WalletKitTypes.SessionProposal) => {
    // [18:30:03.094] [[WalletKit] onSessionProposal: ] {
    //   "id": 1745011791679858,
    //   "params": {
    //     "id": 1745011791679858,
    //     "pairingTopic": "b4e04a244607517390ec4c72650cbceaf142a948dd6804cd2f0e876245cfe39c",
    //     "expiryTimestamp": 1745012091,
    //     "requiredNamespaces": {
    //       "stellar": {
    //         "chains": [
    //           "stellar:pubnet"
    //         ],
    //         "methods": [
    //           "stellar_signAndSubmitXDR"
    //         ],
    //         "events": []
    //       }
    //     },
    //     "optionalNamespaces": {},
    //     "relays": [
    //       {
    //         "protocol": "irn"
    //       }
    //     ],
    //     "proposer": {
    //       "publicKey": "af62ea3b41c049be50218ef646f9e725c39f9350fa0d96f69aa2e9b0725ddb28",
    //       "metadata": {
    //         "description": "Buy, sell, and trade any token on the Stellar network in seconds just by connecting your wallet.",
    //         "url": "https://www.stellarx.com",
    //         "icons": [
    //           "https://www.stellarx.com/images/favicon.png",
    //           "https://www.stellarx.com/images/ios/touch-icon.png"
    //         ],
    //         "name": "StellarX — DEX trading platform with AMM access"
    //       }
    //     }
    //   }
    // }
    logger.debug("WalletKit", "onSessionProposal: ", { id, params });
    try{
      
      // ------- namespaces builder util ------------ //
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces: {
          stellar: {
            methods: ['stellar_signXDR', "stellar_signAndSubmitXDR"],
            chains: ['stellar:testnet', 'stellar:pubnet'],
            events: ['accountsChanged'],
            accounts: [`stellar:testnet:${address}`, `stellar:pubnet:${address}`],
          }
        }
      });
      // ------- end namespaces builder util ------------ //
  
      const session = await walletKit.approveSession({
        id,
        namespaces: approvedNamespaces
      });
  
      // Call this after WCURI is receive
      logger.debug("WalletKit", "onSessionProposal Success: ", session);
    }catch(error){
      // use the error.message to show toast/info-box letting the user know that the connection attempt was unsuccessful
     logger.error("WalletKit", "onSessionProposal Error: ", error);
  
      await walletKit.rejectSession({
        id,
        reason: getSdkError("USER_REJECTED" as SdkErrorKey)
      })
    }
  }, []);
  
  const onSessionRequest = useCallback(async ({ id, params, topic }: WalletKitTypes.SessionRequest) => {
    logger.debug("WalletKit", "onSessionRequest: ", { id, params, topic });
  
    // const { xdr } = params;
    // const requestParamsTxXdr = request.params[0];
  
    // convert `requestParamsMessage` by using a method like hexToUtf8
    // const message = hexToUtf8(requestParamsMessage);
  
    // sign the message
    // const signedTransaction = await signTransaction(xdr);
  
    // const response = { id, result: { signedXDR: signedTransaction }, jsonrpc: "2.0" };
  
    // To reject a session request, the response should be similar to this.
    // const response = {
    //   id,
    //   jsonrpc: "2.0",
    //   error: {
    //     code: 5000,
    //     message: "User rejected.",
    //   },
    // };
  
    // await walletKit.respondSessionRequest({ topic, response });
  
  }, []);
  
  const onSessionDelete = useCallback(async ({ id, topic }: WalletKitTypes.SessionDelete) => {
    logger.debug("WalletKit", "onSessionDelete: ", id);
  
    // await walletKit.disconnectSession({
    //   topic,
    //   reason: getSdkError("USER_DISCONNECTED"),
    // });
  }, []);
  
  const onProposalExpire = useCallback(async ({ id }: WalletKitTypes.ProposalExpire) => {
    logger.debug("WalletKit", "onProposalExpire: ", id);
  }, []);
  
  const onSessionRequestExpire = useCallback(async ({ id }: WalletKitTypes.SessionRequestExpire) => {
    logger.debug("WalletKit", "onSessionRequestExpire: ", id);
  }, []);
  
  const onSessionAuthenticate = useCallback(async ({ id, topic }: WalletKitTypes.SessionAuthenticate) => {
    logger.debug("WalletKit", "onSessionAuthenticate: ", id);
  }, []);

  /******************************************************************************
   * Set up WalletKit event listeners
   *****************************************************************************/
  useEffect(() => {
    if (initialized) {
      //sign
      walletKit.on('session_proposal', onSessionProposal);
      walletKit.on('session_request', onSessionRequest);
      // auth
      walletKit.on('session_authenticate', onSessionAuthenticate);

      walletKit.on('session_delete', onSessionDelete);
      walletKit.on('proposal_expire', onProposalExpire);
      walletKit.on('session_request_expire', onSessionRequestExpire);

      walletKit.engine.signClient.events.on('session_ping', data => {
        logger.debug("WalletKit", "session_ping received", data);
      });
      
      // load sessions on init
      const activeSessions = walletKit.getActiveSessions();
      logger.debug("WalletKit", "activeSessions: ", activeSessions);
    }
  }, [initialized, onSessionProposal, onSessionRequest, onSessionDelete, onProposalExpire, onSessionRequestExpire, onSessionAuthenticate]);
}

/*
// await walletKit.disconnectSession({
//   topic,
//   reason: getSdkError("USER_DISCONNECTED"),
// });

// Updating a Session
// The session_update event is emitted from the wallet when the session is updated by calling updateSession. To update a session, pass in the topic and the new namespace.
// await walletKit.updateSession({ topic, namespaces: newNs });
​
// Extending a Session
// To extend the session, call the extendSession method and pass in the new topic. The session_update event will be emitted from the wallet.
// await walletKit.extendSession({ topic });

// Emitting Session Events
// To emit session events, call the emitSessionEvent and pass in the params. If you wish to switch to chain/account that is not approved (missing from session.namespaces) you will have to update the session first. In the following example, the wallet will emit session_event that will instruct the dapp to switch the active accounts.
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