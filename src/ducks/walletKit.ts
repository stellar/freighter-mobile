import { WalletKitTypes } from "@reown/walletkit";
import { SessionTypes } from "@walletconnect/types";
import { NETWORKS } from "config/constants";
import {
  disconnectAllSessions,
  getActiveSessions,
} from "helpers/walletKitUtil";
import Config from "react-native-config";
import { create } from "zustand";

/** Project ID for WalletKit initialization */
export const {
  WALLET_KIT_PROJECT_ID,
  WALLET_KIT_MT_NAME,
  WALLET_KIT_MT_DESCRIPTION,
  WALLET_KIT_MT_URL,
  WALLET_KIT_MT_ICON,
  WALLET_KIT_MT_REDIRECT_NATIVE,
} = Config;

/** Metadata for the WalletKit instance */
export const WALLET_KIT_METADATA = {
  name: WALLET_KIT_MT_NAME,
  description: WALLET_KIT_MT_DESCRIPTION,
  url: WALLET_KIT_MT_URL,
  icons: [WALLET_KIT_MT_ICON],
  redirect: {
    native: WALLET_KIT_MT_REDIRECT_NATIVE,
  },
};

/**
 * Enum representing different types of WalletKit events
 */
export enum WalletKitEventTypes {
  SESSION_PROPOSAL = "session_proposal",
  SESSION_REQUEST = "session_request",
  NONE = "none",
}

/**
 * Enum representing supported Stellar chains
 */
export enum StellarRpcChains {
  PUBLIC = "stellar:pubnet",
  TESTNET = "stellar:testnet",
}

/**
 * Enum representing supported Stellar RPC methods
 */
export enum StellarRpcMethods {
  SIGN_XDR = "stellar_signXDR",
  SIGN_AND_SUBMIT_XDR = "stellar_signAndSubmitXDR",

  // This is actually a Ethereum RPC method, but it's being used by Allbridge
  // so let's just recognize it as a valid method so we don't reject their connection
  PERSONAL_SIGN = "personal_sign",
}

/**
 * Enum representing supported Stellar events
 */
export enum StellarRpcEvents {
  ACCOUNTS_CHANGED = "accountsChanged",
}

/**
 * Type representing a WalletKit session proposal event
 */
export type WalletKitSessionProposal = WalletKitTypes.SessionProposal & {
  type: WalletKitEventTypes.SESSION_PROPOSAL;
};

/**
 * Type representing a WalletKit session request event
 */
export type WalletKitSessionRequest = WalletKitTypes.SessionRequest & {
  type: WalletKitEventTypes.SESSION_REQUEST;
};

/** Default event state when no event is active */
const noneEvent = {
  type: WalletKitEventTypes.NONE,
};

/**
 * Union type representing all possible WalletKit events
 */
export type WalletKitEvent =
  | WalletKitSessionProposal
  | WalletKitSessionRequest
  | typeof noneEvent;

/**
 * Type representing active WalletKit sessions
 */
export type ActiveSessions = { [topic_key: string]: SessionTypes.Struct };

/**
 * Interface defining the WalletKit store state and actions
 */
interface WalletKitState {
  /** Current WalletKit event */
  event: WalletKitEvent;
  /** Function to set a new event */
  setEvent: (event: WalletKitEvent) => void;
  /** Function to clear the current event */
  clearEvent: () => void;
  /** Map of active sessions */
  activeSessions: ActiveSessions;
  /** Function to fetch active sessions */
  fetchActiveSessions: (publicKey: string, network: NETWORKS) => void;
  /** Function to disconnect all sessions */
  disconnectAllSessions: (
    publicKey?: string,
    network?: NETWORKS,
  ) => Promise<void>;
}

/**
 * Zustand store for managing WalletKit state
 */
export const useWalletKitStore = create<WalletKitState>((set) => ({
  event: noneEvent,
  activeSessions: {},
  setEvent: (event) => set({ event }),
  clearEvent: () => set({ event: noneEvent }),
  fetchActiveSessions: (publicKey: string, network: NETWORKS) => {
    const activeSessions = getActiveSessions(publicKey, network);
    set({ activeSessions });
  },
  disconnectAllSessions: async (publicKey?: string, network?: NETWORKS) => {
    await disconnectAllSessions(publicKey, network);
    set({ event: noneEvent, activeSessions: {} });
  },
}));
