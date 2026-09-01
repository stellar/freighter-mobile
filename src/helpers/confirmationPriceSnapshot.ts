import { NETWORKS } from "config/constants";
import { TokenIdentifier, TokenPricesMap } from "config/types";
import { fetchTokenPrices } from "services/backend";

export enum PriceSource {
  TOKEN_PRICES_V1 = "token_prices_v1",
  TOKEN_PRICES_V2 = "token_prices_v2",
}

export enum PriceFreshness {
  CONFIRMATION_FETCH = "confirmation_fetch",
  CACHED_DISPLAY = "cached_display",
}

export interface ConfirmationPriceSnapshot {
  /** Prices by canonical id. `null` when no snapshot could be produced. */
  pricesById: TokenPricesMap | null;
  freshness: PriceFreshness;
  source: PriceSource;
}

export interface ConfirmationSnapshotHandle {
  /**
   * Freezes and returns the snapshot for a terminal event. Call exactly once,
   * at terminal status. If the fetch already succeeded, uses its result
   * (`confirmation_fetch`); otherwise — still pending, rejected, or cancelled
   * — the fetch is aborted and its result, even if it lands later, is never
   * consulted again, and this falls back to the prices already cached for the
   * on-screen display estimate (`cached_display`).
   */
  resolve(): ConfirmationPriceSnapshot;
  /**
   * Aborts the fetch and discards its result without producing a snapshot.
   * For a confirmation attempt that ends before submission — no terminal
   * event will consume the snapshot, so the request is cancelled immediately.
   * Idempotent, and safe after `resolve()`.
   */
  cancel(): void;
}

/**
 * Issues ONE price fetch covering every leg's canonical id, started at
 * confirmation and never blocking signing/submission — callers do not await
 * this. `cachedDisplayPrices` is the price already held for the on-screen
 * fiat estimate for THIS transaction's legs, captured by the caller at this
 * same moment (e.g. `sourceBalance.currentPrice` / a swap destination's
 * `currentPrice`): it must reflect "the price already shown to the user",
 * not whatever a price cache holds later when `resolve()` is called.
 */
export const startConfirmationPriceSnapshot = ({
  canonicalIds,
  network,
  useV2,
  cachedDisplayPrices,
}: {
  canonicalIds: TokenIdentifier[];
  network: NETWORKS;
  useV2: boolean;
  cachedDisplayPrices: TokenPricesMap | null;
}): ConfirmationSnapshotHandle => {
  const source = useV2
    ? PriceSource.TOKEN_PRICES_V2
    : PriceSource.TOKEN_PRICES_V1;

  const controller = new AbortController();
  let succeeded = false;
  let fetchedPrices: TokenPricesMap | null = null;

  // Never an unhandled rejection: a failed fetch degrades to cached_display
  // exactly like one that's merely still pending at resolve() time.
  fetchTokenPrices({
    tokens: canonicalIds,
    network,
    useV2,
    signal: controller.signal,
  })
    .then((result) => {
      // A result landing after abort is discarded, never consulted.
      if (!controller.signal.aborted) {
        fetchedPrices = result;
        succeeded = true;
      }
    })
    .catch(() => {
      // Rejected (network error, non-2xx, or aborted): fall back to the
      // display-cache price at resolve() time rather than reporting the legs
      // unpriced — coverage takes priority over freshness.
      succeeded = false;
    });

  return {
    resolve: () => {
      if (succeeded) {
        return {
          pricesById: fetchedPrices,
          freshness: PriceFreshness.CONFIRMATION_FETCH,
          source,
        };
      }
      // Pending, rejected, or cancelled: abort so the request cannot outlive
      // the flow that needed it, and close on the display cache.
      controller.abort();
      return {
        pricesById: cachedDisplayPrices,
        freshness: PriceFreshness.CACHED_DISPLAY,
        source,
      };
    },
    cancel: () => {
      controller.abort();
    },
  };
};
