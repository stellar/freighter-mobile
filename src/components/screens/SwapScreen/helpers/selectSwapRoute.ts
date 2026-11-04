import { SwapQuotes, SwapRoute } from "config/types";

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
