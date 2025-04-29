import { create } from "zustand";

export enum WalletKitEventTypes {
  SESSION_PROPOSAL = "session_proposal",
  SESSION_REQUEST = "session_request",
  NONE = "none",
}

export enum StellarRpcMethods {
  SIGN_XDR = "stellar_signXDR",
  SIGN_AND_SUBMIT_XDR = "stellar_signAndSubmitXDR",
}

export enum StellarRpcEvents {
  ACCOUNT_CHANGED = "accountChanged",
}

export enum StellarRpcChains {
  PUBNET = "stellar:pubnet",
  TESTNET = "stellar:testnet",
}

// TODO: import from walletkit
export type SessionProposal = {
  id: string;
  pairingTopic: string;
  expiryTimestamp: number;
  requiredNamespaces: {
    stellar: {
      chains: StellarRpcChains[];
      methods: StellarRpcMethods[];
      events: StellarRpcEvents[];
    };
  };
  optionalNamespaces: Record<string, string[]>;
  relays: {
    protocol: string;
  }[];
  proposer: {
    publicKey: string;
    metadata: {
      description: string;
      url: string;
      icons: string[];
      name: string;
    };
  };
};

// TODO: import from walletkit
export type SessionRequest = {
  request: {
    method: StellarRpcMethods;
    params: { xdr: string };
  };
  chainId: StellarRpcChains;
};

export type WalletKitEvent =
  | {
      id: string;
      type: WalletKitEventTypes.SESSION_PROPOSAL;
      params: SessionProposal;
      verifyContext: VerifyContext;
    }
  | {
      id: string;
      type: WalletKitEventTypes.SESSION_REQUEST;
      topic: string;
      params: SessionRequest;
      verifyContext: VerifyContext;
    }
  | {
      type: WalletKitEventTypes.NONE;
    };

type VerifyContext = {
  verified: {
    verifyUrl: string;
    validation: string;
    origin: string;
  };
};

const noneEvent: WalletKitEvent = {
  type: WalletKitEventTypes.NONE,
};

interface WalletKitState {
  event: WalletKitEvent;
  setEvent: (event: WalletKitEvent) => void;
  clearEvent: () => void;
}

export const useWalletKitStore = create<WalletKitState>((set) => ({
  event: noneEvent,
  setEvent: (event) => set({ event }),
  clearEvent: () => set({ event: noneEvent }),
}));
