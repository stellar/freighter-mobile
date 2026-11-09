import {
  selectSwapRoute,
  swapQuoteErrorReason,
} from "components/screens/SwapScreen/helpers/selectSwapRoute";
import { SwapQuotes, SwapRoute } from "config/types";

const USDC = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const route = (source: string, toAmount: string): SwapRoute => ({
  source,
  fromAmount: "100",
  toAmount,
  paths: [{ share: "1", hops: [{ venue: "v", from: "XLM", to: USDC }] }],
  fees: [],
});

describe("selectSwapRoute", () => {
  it("picks the backend's best route, whichever source quoted it", () => {
    const lifi = route("lifi", "18");
    const quotes: SwapQuotes = {
      routes: [lifi, route("classic", "17")],
      unavailable: [],
    };

    expect(selectSwapRoute(quotes)).toBe(lifi);
  });

  it("returns null for empty routes", () => {
    expect(
      selectSwapRoute({
        routes: [],
        unavailable: [{ source: "classic", reason: "no_route" }],
      }),
    ).toBeNull();
  });
});

describe("swapQuoteErrorReason", () => {
  const apiError = (status: number) => ({
    message: `status ${status}`,
    status,
    isNetworkError: false,
  });

  it("treats a backend rate limit (429) as unavailable", () => {
    expect(swapQuoteErrorReason(apiError(429))).toBe("unavailable");
  });
});
