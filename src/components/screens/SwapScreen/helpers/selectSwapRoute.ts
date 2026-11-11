import { SwapQuotes, SwapRoute } from "config/types";
import { isApiError } from "services/apiFactory";

/** The route the swap uses: the backend's best, which `/swap/tx` builds. */
export const selectSwapRoute = (quotes: SwapQuotes): SwapRoute | null =>
  quotes.routes[0] ?? null;

const OUTAGE_REASONS = ["error", "timeout", "rate_limited"];

/**
 * Why no source quoted. Only a classic outage reads as "unavailable": the
 * spec (§8) shows a LI.FI outage as "no quote" for pairs classic can't serve.
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
