import { WalletKitTypes } from "@reown/walletkit";
import {
  disconnectAllSessions,
  getActiveSessions,
} from "helpers/walletKitUtil";
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
  PUBLIC = "stellar:pubnet",
  TESTNET = "stellar:testnet",
}

export type WalletKitSessionProposal = WalletKitTypes.SessionProposal & {
  type: WalletKitEventTypes.SESSION_PROPOSAL;
};

export type WalletKitSessionRequest = WalletKitTypes.SessionRequest & {
  type: WalletKitEventTypes.SESSION_REQUEST;
};

const noneEvent = {
  type: WalletKitEventTypes.NONE,
};

export type WalletKitEvent =
  | WalletKitSessionProposal
  | WalletKitSessionRequest
  | typeof noneEvent;

export type DappMetadata = {
  name: string;
  description: string;
  url: string;
  icons: string[];
};

export type ActiveSession = {
  relay: {
    protocol: string;
  };
  namespaces: {
    stellar: {
      chains: StellarRpcChains[];
      methods: StellarRpcMethods[];
      events: StellarRpcEvents[];
      accounts: string[];
    };
  };
  controller: string;
  expiry: number;
  topic: string;
  requiredNamespaces: {
    stellar: {
      chains: StellarRpcChains[];
      methods: StellarRpcMethods[];
      events: StellarRpcEvents[];
    };
  };
  optionalNamespaces: Record<string, unknown>;
  pairingTopic: string;
  acknowledged: boolean;
  self: {
    publicKey: string;
    metadata: DappMetadata;
  };
  peer: {
    publicKey: string;
    metadata: DappMetadata;
  };
  transportType: string;
};

export type ActiveSessions = { [topic_key: string]: ActiveSession };

interface WalletKitState {
  event: WalletKitEvent;
  setEvent: (event: WalletKitEvent) => void;
  clearEvent: () => void;
  activeSessions: ActiveSessions;
  fetchActiveSessions: () => Promise<void>;
  disconnectAllSessions: () => Promise<void>;
}

export const useWalletKitStore = create<WalletKitState>((set) => ({
  event: noneEvent,
  activeSessions: {},
  setEvent: (event) => set({ event }),
  clearEvent: () => set({ event: noneEvent }),
  fetchActiveSessions: async () => {
    const activeSessions = await getActiveSessions();
    set({ activeSessions });
  },
  disconnectAllSessions: async () => {
    await disconnectAllSessions();
    set({ activeSessions: {} });
  },
}));
