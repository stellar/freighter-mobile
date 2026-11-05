import { SwapQuotes, SwapRoute } from "config/types";
import { isApiError } from "services/apiFactory";

/**
 * The route the swap uses. Classic only, not `routes[0]`, while the client
 * still builds the transaction itself and can build only a classic path
 * payment.
 */
export const selectSwapRoute = (quotes: SwapQuotes): SwapRoute | null =>
  quotes.routes.find((route) => route.source === "classic") ?? null;

/**
 * A classic route's path-payment `path`: the assets between the sold and the
 * received asset, in the `XLM` / `CODE:ISSUER` form the transaction builder
 * reads. Classic routes have exactly one path.
 */
export const swapRouteIntermediateAssets = (route: SwapRoute): string[] =>
  (route.paths[0]?.hops ?? []).slice(0, -1).map((hop) => hop.to);

const OUTAGE_REASONS = ["error", "timeout", "rate_limited"];

/**
 * Why `selectSwapRoute` found nothing: an outage of the source it selects, or
 * a pair that source can't quote. Change with `selectSwapRoute`.
 */
export const missingSwapRouteReason = (
  quotes: SwapQuotes,
): "unavailable" | "noRoute" => {
  const classic = quotes.unavailable.find((u) => u.source === "classic");
  return classic && OUTAGE_REASONS.includes(classic.reason)
    ? "unavailable"
    : "noRoute";
};

/** Maps a failed quote request; null leaves it to the caller's generic handling. */
export const swapQuoteErrorReason = (
  error: unknown,
): "unavailable" | "noRoute" | null => {
  if (!isApiError(error)) return null;
  if (error.status === 400) return "noRoute";
  if (error.status === 0 || error.status === 401 || error.status >= 500) {
    return "unavailable";
  }
  return null;
};
