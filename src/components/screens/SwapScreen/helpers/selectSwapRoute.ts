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

/**
 * Maps a failed quote request. A 400 is the request (bad input, an unfunded
 * account); any other HTTP failure, and a body the parser rejected, means the
 * backend can't quote right now. Null leaves a non-HTTP error (the debug
 * failure switch) to the caller's generic handling.
 */
export const swapQuoteErrorReason = (
  error: unknown,
): "unavailable" | "noRoute" | null => {
  if (error instanceof Error && error.name === "SwapQuotesResponseError") {
    return "unavailable";
  }
  if (!isApiError(error)) return null;
  return error.status === 400 ? "noRoute" : "unavailable";
};
