import type { DappApprovalKind, DappRequest } from "config/dappRequest";
import { create } from "zustand";

/** A WebView request waiting for the user's decision in WalletKitProvider. */
export interface WebviewApproval {
  kind: DappApprovalKind;
  request: DappRequest;
}

interface DappApprovalState {
  // State
  /** The WebView request currently owning the approval sheets, if any. */
  job: WebviewApproval | null;
  /** True while WalletConnect owns the approval sheets; WebView requests get BUSY meanwhile. */
  walletConnectBusy: boolean;

  // Actions
  setJob: (job: WebviewApproval | null) => void;
  /** Clears the job only if it still belongs to `request`, so a late response cannot evict a newer job. */
  clearJob: (request: DappRequest) => void;
  setWalletConnectBusy: (busy: boolean) => void;
}

/** One native approval surface, shared by the WalletConnect and WebView transports. */
export const useDappApprovalStore = create<DappApprovalState>((set, get) => ({
  job: null,
  walletConnectBusy: false,

  setJob: (job) => set({ job }),
  clearJob: (request) => {
    if (get().job?.request === request) set({ job: null });
  },
  setWalletConnectBusy: (walletConnectBusy) => set({ walletConnectBusy }),
}));
