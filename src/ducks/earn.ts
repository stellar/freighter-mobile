import { BlendCatalogPool } from "config/blendTypes";
import { DEFAULT_DECIMALS } from "config/constants";
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
   * The chosen asset's rate (supply interest only, no BLND emissions) as a
   * decimal fraction, or null when the oracle has no fresh price. Carried from the token
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
   * Whether a swap finished inside this Earn session, for the deposit's
   * `via_swap` analytics. Like the extension's, it stays set for the rest of
   * the session, whichever token is deposited.
   */
  didSwapInFlow: boolean;
  /**
   * Where this Earn session was opened from, carried on its deposit events
   * as `source`, as in the extension.
   */
  source: EarnSource;
  /**
   * This session opened on the amount screen, prefilled from a token's
   * position, with the token picker mounted under it for Back. The picker
   * then skips the first-visit intro, as the extension's prefilled entry
   * does: it would report a view nobody saw, and Back would land on it.
   */
  isPrefilledEntry: boolean;

  setPool: (pool: BlendCatalogPool | null) => void;
  selectAsset: (params: {
    assetId: string;
    apy: number | null;
    code: string;
    decimals: number;
  }) => void;
  setCurrentPositionTokens: (tokens: string) => void;
  setDidSwapInFlow: (didSwap: boolean) => void;
  setSource: (source: EarnSource) => void;
  setIsPrefilledEntry: (isPrefilledEntry: boolean) => void;
  resetEarn: () => void;
}

/**
 * Where an Earn session starts: Home's Earn tile, a token's Deposit on its
 * position screen, the Positions tab's Deposit button, or its empty state.
 */
export type EarnSource =
  | "home"
  | "position_row"
  | "positions_pill"
  | "positions_empty";

const initialState = {
  pool: null,
  selectedAssetId: "",
  selectedAssetApy: null,
  selectedAssetCode: "",
  selectedAssetDecimals: DEFAULT_DECIMALS,
  currentPositionTokens: "0",
  didSwapInFlow: false,
  source: "home" as EarnSource,
  isPrefilledEntry: false,
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

  setDidSwapInFlow: (didSwapInFlow) => set({ didSwapInFlow }),

  setSource: (source) => set({ source }),

  setIsPrefilledEntry: (isPrefilledEntry) => set({ isPrefilledEntry }),

  resetEarn: () => set({ ...initialState }),
}));
