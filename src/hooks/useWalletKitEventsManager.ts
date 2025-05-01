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
    // [10:37:41.337] [[WalletKit] onSessionRequest: ] {
    //   "id": 1746106660565626,
    //   "topic": "2436baceea330e480b05c3317d4a2a1b73c06f0ddb2e948821834ba4ffd9c0d2",
    //   "params": {
    //     "request": {
    //       "jsonrpc": "2.0",
    //       "method": "stellar_signAndSubmitXDR",
    //       "params": {
    //         "xdr": "AAAAAgAAAABiYAd0QKmkoRw9vfUCblDMI1urU8xQOdBftbIfhMGjpgABhqADYYJ6AAAAHQAAAAEAAAAAAAAAAAAAAABoOwYkAAAAAAAAAAEAAAAAAAAADQAAAAAAAAAAALxLIAAAAABiYAd0QKmkoRw9vfUCblDMI1urU8xQOdBftbIfhMGjpgAAAAFVU0RDAAAAADuZETgO/piLoKiQDrHP5E82b32+lGvtB3JA9/Yk3xXFAAAAAAAxv+oAAAAAAAAAAAAAAAA="
    //       },
    //       "expiryTimestamp": 1746106960
    //     },
    //     "chainId": "stellar:pubnet"
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "UNKNOWN",
    //       "origin": "https://www.stellarx.com"
    //     }
    //   }
    // }
    
    // [10:42:59.296] [[WalletKit] onSessionRequest: ] {
    //   "id": 1746106738068564,
    //   "topic": "1a901cc5effcb2f284d030ea72c2501eea46ce6868ccbae73d949214ae3bbd6d",
    //   "params": {
    //     "request": {
    //       "method": "stellar_signXDR",
    //       "params": {
    //         "xdr": "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"
    //       },
    //       "expiryTimestamp": 1746107038
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

    // [10:48:27.562] [[WalletKit] onSessionRequest: ] {
    //   "id": 1746107101215362,
    //   "topic": "8c0335142d9013311ed720b9240d09c14f084605b566108e53ade298f05b7e20",
    //   "params": {
    //     "request": {
    //       "method": "stellar_signXDR",
    //       "params": {
    //         "xdr": "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"
    //       },
    //       "expiryTimestamp": 1746107401
    //     },
    //     "chainId": "stellar:pubnet"
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "UNKNOWN",
    //       "origin": "https://fxdao.io"
    //     }
    //   }
    // }

    // [10:55:37.885] [[WalletKit] onSessionRequest: ] {
    //   "id": 1746107737330899,
    //   "topic": "cb592a7f0308580a94600d8f6a4aa3540fc7235c7110dba15a781e37f364cb7e",
    //   "params": {
    //     "request": {
    //       "method": "stellar_signXDR",
    //       "params": {
    //         "xdr": "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"
    //       },
    //       "expiryTimestamp": 1746108037
    //     },
    //     "chainId": "stellar:pubnet"
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

    // [10:58:00.495] [[WalletKit] onSessionRequest: ] {
    //   "id": 1746107879741026,
    //   "topic": "a9e7db8203a674071a3445784e6e3a67fdbf687cd957169ac24e0b78df6dff4d",
    //   "params": {
    //     "request": {
    //       "method": "stellar_signAndSubmitXDR",
    //       "params": {
    //         "xdr": "AAAAAgAAAABiYAd0QKmkoRw9vfUCblDMI1urU8xQOdBftbIfhMGjpgABhqADYYJ6AAAAHQAAAAEAAAAAAAAAAAAAAABoOwrnAAAAAAAAAAEAAAAAAAAADAAAAAFVU0R4AAAAACp+5sAQMaed9DcKvaznSjCDuK+SKGZpR1a6JNrnBX0FAAAAAAAAAAAtkHa/ABjzawBMS0AAAAAAAAAAAAAAAAAAAAAA"
    //       }
    //     },
    //     "chainId": "stellar:pubnet"
    //   },
    //   "verifyContext": {
    //     "verified": {
    //       "verifyUrl": "https://verify.walletconnect.org",
    //       "validation": "UNKNOWN",
    //       "origin": "https://stellarterm.com"
    //     }
    //   }
    // }
    
    logger.debug("WalletKit", "onSessionRequest: ", args);
  
    const { id, params, topic } = args;
    const { request } = params || {};
    const { method, params: requestParams } = request || {};

    // TODO: test approving request with unsupported namespaces
    return;

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