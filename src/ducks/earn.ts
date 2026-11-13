import { BlendCatalogPool } from "config/blendTypes";
import { create } from "zustand";

/**
 * Earn-domain state that has no home in `transactionBuilder`.
 *
 * The deposit's transaction-shaped state (XDR, fees, submit status) deliberately
 * lives in `transactionBuilder` instead, so Earn reuses the shared sign/submit
 * path rather than duplicating it. What lands here is what must survive that
 * store's reset, or has no equivalent field there.
 */
interface EarnState {
  /** Catalog entry for the allowlisted pool; null until the fetch resolves. */
  pool: BlendCatalogPool | null;
  /**
   * The chosen asset's contract address (its SAC). Captured at pick time rather
   * than re-derived later: the pool addresses reserves by contract id, and the
   * deposit's Request carries that address, not the code.
   */
  selectedAssetId: string;
  /**
   * The chosen asset's headline rate (supply APY + emissions APR) as a decimal
   * fraction, or null when the oracle has no fresh price. Carried from the token
   * picker so the amount and review screens don't re-derive it — and so the rate
   * cannot shift under the user mid-entry.
   */
  selectedAssetApy: number | null;
  selectedAssetCode: string;
  selectedAssetDecimals: number;
  /**
   * The account's existing balance in the pool for the chosen asset, in raw
   * token units — the "before" side of Review. Defaults to "0", which is also
   * what a fetch failure falls back to.
   */
  currentPositionTokens: string;
  /**
   * Drives the "Transaction failed. Try again." banner on the amount screen.
   *
   * Lives here rather than in component state because it is set on the
   * processing screen and read after the stack has popped back to Amount —
   * component state would be torn down in between.
   */
  lastSubmitFailed: boolean;

  setPool: (pool: BlendCatalogPool | null) => void;
  selectAsset: (params: {
    assetId: string;
    apy: number | null;
    code: string;
    decimals: number;
  }) => void;
  setCurrentPositionTokens: (tokens: string) => void;
  setSubmitFailed: (failed: boolean) => void;
  resetEarn: () => void;
}

const initialState = {
  pool: null,
  selectedAssetId: "",
  selectedAssetApy: null,
  selectedAssetCode: "",
  selectedAssetDecimals: 7,
  currentPositionTokens: "0",
  lastSubmitFailed: false,
};

export const useEarnStore = create<EarnState>((set) => ({
  ...initialState,

  setPool: (pool) => set({ pool }),

  // Resets `currentPositionTokens` back to its "0" default on every asset
  // switch, mid-flow or not. `useEarnPosition`'s fetch is non-fatal by
  // design (see its docs) and leaves the duck holding whatever it already
  // had on failure — without this reset, picking asset A (fetch succeeds),
  // backing out, then picking asset B (fetch fails) would carry A's
  // position into B's Review "before" value.
  selectAsset: ({ assetId, apy, code, decimals }) =>
    set({
      selectedAssetId: assetId,
      selectedAssetApy: apy,
      selectedAssetCode: code,
      selectedAssetDecimals: decimals,
      currentPositionTokens: initialState.currentPositionTokens,
    }),

  setCurrentPositionTokens: (currentPositionTokens) =>
    set({ currentPositionTokens }),

  setSubmitFailed: (lastSubmitFailed) => set({ lastSubmitFailed }),

  resetEarn: () => set({ ...initialState }),
}));
