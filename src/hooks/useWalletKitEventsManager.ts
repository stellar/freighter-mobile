import {useCallback, useEffect} from 'react';
import { WalletKitTypes } from "@reown/walletkit";
import { buildApprovedNamespaces, getSdkError, SdkErrorKey } from '@walletconnect/utils';
import { walletKit } from 'helpers/walletKitUtil';
import { logger } from 'config/logger';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import { Linking } from 'react-native';

const stellarNamespaceMethods = ["stellar_signXDR", "stellar_signAndSubmitXDR"];

// TODO: get address from wallet
// This is Cassio's main address on Freighter for both testnet and pubnet
// const address = "GDAFOKARX4VPZHPDBY5UTIRK32GUGCC7PQJ4SGQYGOEYNV2XSE5TY4KE";
const address = "GBRGAB3UICU2JII4HW67KATOKDGCGW5LKPGFAOOQL623EH4EYGR2MXRR";

// TODO: get keypair from wallet
const signTransaction = (transaction: string): string => {
  const networkPassphrase = "Public Global Stellar Network ; September 2015";
  const txEnvelope = TransactionBuilder.fromXDR(transaction, networkPassphrase);

  // GBRGAB3UICU2JII4HW67KATOKDGCGW5LKPGFAOOQL623EH4EYGR2MXRR
  const keypair = Keypair.fromSecret("SC7Z3SVDYNT5RHE7F33F52WNWWIVULXWBYBCDJ6Z3WWX5USRHATQFTVO");
  txEnvelope.sign(keypair);

  return txEnvelope.toXDR();
};

export default function useWalletKitEventsManager(initialized: boolean) {

  const onSessionProposal = useCallback(async (args: WalletKitTypes.SessionProposal) => {
    // [11:08:36.298] [[WalletKit] onSessionProposal: ] {
    //   "id": 1745935705440946,
    //   "params": {
    //     "id": 1745935705440946,
    //     "pairingTopic": "1db053115d2332fe66221cdd14ccfe567b52c0f1b61b4e785186fbd10c9a5eec",
    //     "expiryTimestamp": 1745936005,
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
    //       "publicKey": "aecdb2f68156955fd3e8a480a8d43bdda1d97ac9e7896c2fdb6d25d3b84c2a01",
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
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "UNKNOWN",
    //       "origin": "https://www.stellarx.com"
    //     }
    //   }
    // }

    // [11:27:45.069] [[WalletKit] onSessionProposal: ] {
    //   "id": 1745936853943695,
    //   "params": {
    //     "id": 1745936853943695,
    //     "pairingTopic": "cbdfe7dc5e68915cc65bea16419b6b3690f2617db1efe007c332bca3bac92dcd",
    //     "expiryTimestamp": 1745937153,
    //     "requiredNamespaces": {
    //       "stellar": {
    //         "chains": [
    //           "stellar:pubnet"
    //         ],
    //         "methods": [
    //           "stellar_signAndSubmitXDR",
    //           "stellar_signXDR"
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
    //       "publicKey": "c11b737a9f67e9f6dc7e8ae34a22eefc413e8baa62c770ce09570acd1a2dd265",
    //       "metadata": {
    //         "name": "Aquarius",
    //         "description": "Aquarius - liquidity management layer for Stellar",
    //         "url": "https://aqua.network",
    //         "icons": [
    //           "https://aqua.network/favicon.png"
    //         ]
    //       }
    //     }
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "UNKNOWN",
    //       "origin": "https://aqua.network"
    //     }
    //   }
    // }

    // [11:30:19.291] [[WalletKit] onSessionProposal: ] {
    //   "id": 1745937011044777,
    //   "params": {
    //     "id": 1745937011044777,
    //     "pairingTopic": "54eb7368e59020328c26770ea8188aabb47661e876367972305217941cd708d6",
    //     "expiryTimestamp": 1745937311,
    //     "requiredNamespaces": {
    //       "stellar": {
    //         "methods": [
    //           "stellar_signXDR"
    //         ],
    //         "chains": [
    //           "stellar:pubnet"
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
    //       "publicKey": "da4cd18968e3076fe5bc76435f5875150adf266691d27c50f41ae1c6b5fa3e3a",
    //       "metadata": {
    //         "name": "FxDAO",
    //         "url": "https://fxdao.io",
    //         "description": "A decentralized borrowing protocol for the issuance of decentralized stablecoins on Stellar",
    //         "icons": [
    //           "https://assets.fxdao.io/brand/FxDAO-logo.svg"
    //         ]
    //       }
    //     }
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "UNKNOWN",
    //       "origin": "https://fxdao.io"
    //     }
    //   }
    // }

    // [11:33:02.448] [[WalletKit] onSessionProposal: ] {
    //   "id": 1745937174716810,
    //   "params": {
    //     "id": 1745937174716810,
    //     "pairingTopic": "b8bd13a8c531a1016e634b5fa54269d8ba1e318ce432ea16761a1eb7cc66b888",
    //     "expiryTimestamp": 1745937474,
    //     "requiredNamespaces": {
    //       "stellar": {
    //         "methods": [
    //           "stellar_signXDR"
    //         ],
    //         "chains": [
    //           "stellar:pubnet"
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
    //       "publicKey": "1efa67fac268b7c47763ac9f08b1ac227f4d05dcd49c1880a8108aec29d46c4d",
    //       "metadata": {
    //         "name": "Blend Mainnet",
    //         "url": "https://mainnet.blend.capital",
    //         "description": "Blend is a liquidity protocol primitive, enabling the creation of money markets for any use case.",
    //         "icons": [
    //           "https://docs.blend.capital/~gitbook/image?url=https%3A%2F%2F3627113658-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FlsteMPgIzWJ2y9ruiTJy%252Fuploads%252FVsvCoCALpHWAw8LpU12e%252FBlend%2520Logo%25403x.png%3Falt%3Dmedia%26token%3De8c06118-43b7-4ddd-9580-6c0fc47ce971&width=768&dpr=2&quality=100&sign=f4bb7bc2&sv=1"
    //         ]
    //       }
    //     }
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "VALID",
    //       "origin": "https://mainnet.blend.capital",
    //       "isScam": false
    //     }
    //   }
    // }

    // [18:25:56.286] [[WalletKit] onSessionProposal: ] {
    //   "id": 1745961941812070,
    //   "params": {
    //     "id": 1745961941812070,
    //     "pairingTopic": "4a12d0905c5e7e66ff427dfafd5a305c20865d857afb3f6b91b0f301f05bfe2e",
    //     "expiryTimestamp": 1745962255,
    //     "requiredNamespaces": {
    //       "stellar": {
    //         "chains": [
    //           "stellar:pubnet"
    //         ],
    //         "methods": [
    //           "stellar_signAndSubmitXDR",
    //           "stellar_signXDR"
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
    //       "publicKey": "0e662f9b94c0fb2ac3d2ef1df851375db2c3726ddf977eaffd74a6241cbfff6d",
    //       "metadata": {
    //         "name": "StellarTerm",
    //         "description": "StellarTerm is an advanced web-based trading client for the Stellar network. Send, receive, and trade assets on the Stellar network easily with StellarTerm.",
    //         "url": "https://stellarterm.com",
    //         "icons": [
    //           "https://avatars.githubusercontent.com/u/25021964?s=200&v=4.png"
    //         ]
    //       }
    //     }
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "UNKNOWN",
    //       "origin": "https://stellarterm.com"
    //     }
    //   }
    // }

    // [18:26:46.776] [[WalletKit] onSessionProposal: ] {
    //   "id": 1745961996355019,
    //   "params": {
    //     "id": 1745961996355019,
    //     "pairingTopic": "6a077883977a81677415f41be76778fff5cc717d5b6d98325039991a21559bbd",
    //     "expiryTimestamp": 1745962296,
    //     "requiredNamespaces": {
    //       "stellar": {
    //         "methods": [
    //           "stellar_signAndSubmitXDR"
    //         ],
    //         "chains": [
    //           "stellar:pubnet"
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
    //       "publicKey": "1e5965c16b9fcf5120cd99f072cfeb1ca44ae8b0d16ee518e05436d07d45653a",
    //       "metadata": {
    //         "name": "Phoenix DeFi Hub",
    //         "url": "https://app.phoenix-hub.io",
    //         "description": "Serving only the tastiest DeFi",
    //         "icons": [
    //           "https://app.phoenix-hub.io/logoIcon.png"
    //         ]
    //       }
    //     }
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "UNKNOWN",
    //       "origin": "https://app.phoenix-hub.io"
    //     }
    //   }
    // }

    logger.debug("WalletKit", "onSessionProposal: ", args);

    const { id, params } = args;

    try{
      
      // ------- namespaces builder util ------------ //
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces: {
          stellar: {
            methods: stellarNamespaceMethods,
            chains: ['stellar:testnet', 'stellar:pubnet'],
            events: ['accountsChanged'],
            accounts: [`stellar:testnet:${address}`, `stellar:pubnet:${address}`],
          }
        }
      });
      // ------- end namespaces builder util ------------ //
  
      // TODO: wait 5 minutes to test pairing_expire event
      // return;

      // TODO: test approving session with unsupported namespaces
      const session = await walletKit.approveSession({
        id,
        namespaces: approvedNamespaces
      });
  
      // Call this after WCURI is receive
      logger.debug("WalletKit", "onSessionProposal Success: ", session);

      const dappScheme = session.peer.metadata.redirect?.native;

      if (dappScheme) {
        logger.debug("WalletKit", "onSessionProposal Success DAPP SCHEME FOUND: ", dappScheme);
        // TODO: we should only open URL here if the session was initiated by a deep-link, which
        // means it would make sense to redirect users back to the dapp.
        // In case the session was initiated by a QR code, we should show a toast/info-box letting
        // the user know that they can manually return to the DApp since they are probably handling
        // the dApp session in a desktop browser or another device.
        Linking.openURL(dappScheme);
      } else {
        // Inform the user to manually return to the DApp
        logger.debug("WalletKit", "onSessionProposal NO DAPP SCHEME FOUND, please return to the DApp. Metadata: ", session.peer.metadata);
      }
    }catch(error){
      // use the error.message to show toast/info-box letting the user know that the connection attempt was unsuccessful
     logger.error("WalletKit", "onSessionProposal Error: ", error);
  
      await walletKit.rejectSession({
        id,
        reason: getSdkError("USER_REJECTED" as SdkErrorKey)
      })
    }
  }, []);
  
  const onSessionRequest = useCallback(async (args: WalletKitTypes.SessionRequest) => {  
    // [16:05:07.037] [[WalletKit] onSessionRequest: ] {
    //   "id": 1745262306574617,
    //   "params": {
    //     "request": {
    //       "method": "stellar_signXDR",
    //       "params": {
    //         "xdr": "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"
    //       },
    //       "expiryTimestamp": 1745262606
    //     },
    //     "chainId": "stellar:pubnet"
    //   },
    //   "topic": "ce898b9d89adf9ad7ab7aaa51a6a63955a67b2674869d3365aaedb5d1b93ea33"
    // }

    // [11:37:37.189] [[WalletKit] onSessionRequest: ] {
    //   "id": 1745937456765169,
    //   "topic": "b094a8f70798bf99c019f63a0bfb57836baf770638c8fd46aeabf611d7ffc515",
    //   "params": {
    //     "request": {
    //       "method": "stellar_signXDR",
    //       "params": {
    //         "xdr": "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"
    //       },
    //       "expiryTimestamp": 1745937756
    //     },
    //     "chainId": "stellar:pubnet"
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "UNKNOWN",
    //       "origin": "https://aqua.network"
    //     }
    //   }
    // }
    logger.debug("WalletKit", "onSessionRequest: ", args);
  
    const { id, params, topic } = args;
    const { request } = params || {};
    const { method, params: requestParams } = request || {};

    // TODO: test approving request with unsupported namespaces
    // return;

    if (!stellarNamespaceMethods.includes(method)) { 
      const message = `Invalid or unsupported namespace method: ${method}`;
      logger.error("WalletKit", message, { method });

      const response = {
        id,
        jsonrpc: "2.0",
        error: {
          code: 5000,
          message,
        },
      };

      await walletKit.respondSessionRequest({ topic, response });
      return;
    }
    const { xdr } = requestParams;
    
    let signedTransaction;
    try {
      signedTransaction = signTransaction(xdr);
    } catch (error) {
      const message = `Failed to sign transaction: ${error?.toString()}`;
      logger.error("WalletKit", "signTransaction Error: ", error);

      const response = {
        id,
        jsonrpc: "2.0",
        error: {
          code: 5000,
          message,
        },
      };

      await walletKit.respondSessionRequest({ topic, response });
      return;
    }
  
    const response = { id, result: { signedXDR: signedTransaction }, jsonrpc: "2.0" };
  
    logger.debug("WalletKit", "onSessionRequest wallet response: ", { response });

    try {
      const res = await walletKit.respondSessionRequest({ topic, response });
      logger.debug("WalletKit", "onSessionRequest respondSessionRequest response: ", { res });
    } catch (error) {
      logger.error("WalletKit", "walletKit.respondSessionRequest Error: ", error);
    }
  }, []);
  
  const onSessionDelete = useCallback((args: WalletKitTypes.SessionDelete) => {
    logger.debug("WalletKit", "onSessionDelete: ", args);
  
    walletKit.disconnectSession({
      topic: args.topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });
  }, []);
  
  const onProposalExpire = useCallback((args: WalletKitTypes.ProposalExpire) => {
    logger.debug("WalletKit", "> > > > > onProposalExpire: ", args);

    // TODO: dismiss modal and show toast/info-box letting the user know that the connection attempt was unsuccessful
    // No need to disconnect session here since there is no session to disconnect
  }, []);
  
  const onSessionRequestExpire = useCallback((args: WalletKitTypes.SessionRequestExpire) => {
    logger.debug("WalletKit", "> > > > > onSessionRequestExpire: ", args);

    // TODO: dismiss modal and show toast/info-box letting the user know that the request expired
  }, []);
  
  const onSessionAuthenticate = useCallback((args: WalletKitTypes.SessionAuthenticate) => {
    logger.debug("WalletKit", "> > > > > onSessionAuthenticate: ", args);
  }, []);

  /******************************************************************************
   * Set up WalletKit event listeners
   *****************************************************************************/
  useEffect(() => {
    if (initialized) {
      //sign
      walletKit.on('session_proposal', onSessionProposal);
      walletKit.on('session_request', onSessionRequest);
      
      walletKit.on('session_authenticate', onSessionAuthenticate);
      walletKit.on('session_delete', onSessionDelete);
      walletKit.on('proposal_expire', onProposalExpire);
      walletKit.on('session_request_expire', onSessionRequestExpire);
      
      // load sessions on init
      const activeSessions = walletKit.getActiveSessions();
      logger.debug("WalletKit", "activeSessions: ", activeSessions);

      return;

      for (const session of Object.values(activeSessions)) {
        logger.debug("WalletKit", "disconnecting activeSession: ", session);

        walletKit.disconnectSession({
          topic: session.topic,
          reason: getSdkError("USER_DISCONNECTED"),
        });
      }
    }
  }, [initialized, onSessionProposal, onSessionRequest, onSessionDelete, onProposalExpire, onSessionRequestExpire, onSessionAuthenticate]);
}

/*
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