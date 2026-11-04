import {
  selectSwapRoute,
  swapRouteIntermediateAssets,
} from "components/screens/SwapScreen/helpers/selectSwapRoute";
import { SwapQuotes, SwapRoute } from "config/types";

const USDC = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const AQUA = "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA";

const route = (source: string, toAmount: string): SwapRoute => ({
  source,
  fromAmount: "100",
  toAmount,
  paths: [{ share: "1", hops: [{ venue: "v", from: "XLM", to: USDC }] }],
  fees: [],
});

describe("selectSwapRoute", () => {
  it("picks the classic route even when another source ranks first", () => {
    const classic = route("classic", "17");
    const quotes: SwapQuotes = {
      routes: [route("lifi", "18"), classic],
      unavailable: [],
    };

    expect(selectSwapRoute(quotes)).toBe(classic);
  });

  it("returns null when no classic route was quoted", () => {
    expect(
      selectSwapRoute({ routes: [route("lifi", "18")], unavailable: [] }),
    ).toBeNull();
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

describe("swapRouteIntermediateAssets", () => {
  it("returns the assets between the first hop's source and the last hop's destination", () => {
    const multiHop: SwapRoute = {
      ...route("classic", "17"),
      paths: [
        {
          share: "1",
          hops: [
            { venue: "stellar-dex", from: USDC, to: "XLM" },
            { venue: "stellar-dex", from: "XLM", to: AQUA },
            { venue: "stellar-dex", from: AQUA, to: "EURC:GDHU" },
          ],
        },
      ],
    };

    expect(swapRouteIntermediateAssets(multiHop)).toEqual(["XLM", AQUA]);
  });

  it("returns no intermediates for a direct hop", () => {
    expect(swapRouteIntermediateAssets(route("classic", "17"))).toEqual([]);
  });
});
