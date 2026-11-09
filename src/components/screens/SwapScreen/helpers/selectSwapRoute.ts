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

/** Maps a failed quote request; null leaves it to the caller's generic handling. */
export const swapQuoteErrorReason = (
  error: unknown,
): "unavailable" | "noRoute" | null => {
  if (!isApiError(error)) return null;
  if (error.status === 400) return "noRoute";
  if ([0, 401, 429].includes(error.status) || error.status >= 500) {
    return "unavailable";
  }
  return null;
};
