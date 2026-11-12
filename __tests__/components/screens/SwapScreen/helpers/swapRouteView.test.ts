import { logos } from "assets/logos";
import BigNumber from "bignumber.js";
import {
  buildSwapRouteView,
  formatRouteShare,
} from "components/screens/SwapScreen/helpers/swapRouteView";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import {
  DiscoverProtocol,
  SwapHop,
  SwapRoute,
  TokenTypeWithCustomToken,
} from "config/types";
import type { HeldBalanceItem } from "hooks/useBalancesList";

const USDC = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const EURC = "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2";
const CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const OTHER_CONTRACT =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

const protocol = (name: string, iconUrl: string): DiscoverProtocol => ({
  name,
  iconUrl,
  description: "",
  websiteUrl: `https://${name.toLowerCase()}.example`,
  tags: [],
  isTrending: false,
});

const PROTOCOLS = [
  protocol("Aquarius", "https://icons.example/aquarius.png"),
  protocol("SushiSwap", "https://icons.example/sushiswap.png"),
  protocol("Soroswap", "https://icons.example/soroswap.png"),
];

const hop = (
  venue: string,
  from: string,
  to: string,
  pool?: string,
): SwapHop => ({ venue, from, to, ...(pool ? { pool } : {}) });

const route = (paths: SwapRoute["paths"], source = "lifi"): SwapRoute => ({
  source,
  fromAmount: "100",
  toAmount: "37",
  paths,
  fees: [],
});

const build = (r: SwapRoute | null, balanceItems: HeldBalanceItem[] = []) =>
  buildSwapRouteView({
    route: r,
    protocols: PROTOCOLS,
    balanceItems,
  });

describe("formatRouteShare", () => {
  it.each([
    ["0.32", "32%"],
    ["1", "100%"],
    ["0.325", "33%"],
    ["0.004", "<1%"],
    // Under 1% never rounds up to "1%", as on the extension.
    ["0.006", "<1%"],
  ])("formats %s as %s", (share, expected) => {
    expect(formatRouteShare(share)).toBe(expected);
  });

  it.each(["0", "", "abc", "-0.1"])("returns null for %p", (share) => {
    expect(formatRouteShare(share)).toBeNull();
  });
});

describe("buildSwapRouteView", () => {
  it("returns null with no route or no paths", () => {
    expect(build(null)).toBeNull();
    expect(build(route([]))).toBeNull();
    expect(build(route([{ share: "1", hops: [] }]))).toBeNull();
  });

  it("formats each split path's share and counts its hops as pools", () => {
    const view = build(
      route([
        {
          share: "0.7",
          hops: [
            hop("Aquarius", "XLM", EURC, "p1"),
            hop("SushiSwap", EURC, USDC, "p2"),
          ],
        },
        { share: "0.3", hops: [hop("Soroswap", "XLM", USDC, "p3")] },
      ]),
    );

    expect(view?.paths.map((p) => p.share)).toEqual(["70%", "30%"]);
    expect(view?.paths.map((p) => p.poolCount)).toEqual([2, 1]);
    expect(view?.paths[0].tokens.map((t) => t.code)).toEqual([
      "XLM",
      "EURC",
      "USDC",
    ]);
    expect(view?.from.code).toBe("XLM");
    expect(view?.to.code).toBe("USDC");
  });

  it("lists each venue once across paths, in first-seen order", () => {
    const view = build(
      route([
        {
          share: "0.5",
          hops: [
            hop("Aquarius", "XLM", EURC, "p1"),
            hop("Aquarius", EURC, USDC, "p2"),
          ],
        },
        {
          share: "0.5",
          hops: [
            hop("Soroswap", "XLM", EURC, "p3"),
            hop("aquarius", EURC, USDC, "p4"),
          ],
        },
      ]),
    );

    expect(view?.providers.map((p) => p.name)).toEqual([
      "Aquarius",
      "Soroswap",
    ]);
    // A path row shows one icon per hop, repeats included.
    expect(view?.paths[0].hopVenues.map((v) => v.name)).toEqual([
      "Aquarius",
      "Aquarius",
    ]);
  });

  it("gives a venue /protocols lists its icon, matching the name case-insensitively", () => {
    const view = build(
      route([{ share: "1", hops: [hop("Sushiswap", "XLM", USDC, "p1")] }]),
    );

    expect(view?.providers).toEqual([
      { name: "Sushiswap", iconUrl: "https://icons.example/sushiswap.png" },
    ]);
  });

  it("leaves an unlisted venue without an icon URL, for the generic icon", () => {
    const view = build(
      route([{ share: "1", hops: [hop("Unknown DEX", "XLM", USDC)] }]),
    );

    expect(view?.providers).toEqual([
      { name: "Unknown DEX", iconUrl: undefined },
    ]);
  });

  it("names the classic stellar-dex venue and gives it the Stellar logo", () => {
    const view = build(
      route([{ share: "1", hops: [hop("stellar-dex", "XLM", USDC)] }]),
    );

    expect(view?.providers).toEqual([
      { name: "Stellar DEX", iconSource: logos.stellar },
    ]);
    expect(view?.paths[0].hopVenues).toEqual(view?.providers);
  });

  it("classic stand-in: one path at 100% with no pool count", () => {
    const view = build(
      route(
        [{ share: "1", hops: [hop("stellar-dex", "XLM", USDC)] }],
        "classic",
      ),
    );

    expect(view?.paths).toHaveLength(1);
    expect(view?.paths[0].share).toBe("100%");
    expect(view?.paths[0].poolCount).toBeNull();
  });

  it("counts only the hops that go through a pool", () => {
    const view = build(
      route([
        {
          share: "1",
          hops: [
            hop("Aquarius", "XLM", "AQUA", "p1"),
            hop("stellar-dex", "AQUA", USDC),
          ],
        },
      ]),
    );

    expect(view?.paths[0].poolCount).toBe(1);
  });

  it("shows an unheld contract token shortened, and a held one by its code", () => {
    const held = {
      id: `HELD:${CONTRACT}`,
      tokenCode: "HELD",
      contractId: CONTRACT,
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      total: new BigNumber(1),
    } as unknown as HeldBalanceItem;
    const view = build(
      route([
        {
          share: "1",
          hops: [
            hop("Soroswap", CONTRACT, OTHER_CONTRACT, "p1"),
            hop("Aquarius", OTHER_CONTRACT, USDC, "p2"),
          ],
        },
      ]),
      [held],
    );

    const [first, middle] = view!.paths[0].tokens;
    expect(first.code).toBe("HELD");
    expect(middle.code).toBe("CCW6...MI75");
    expect(middle.token).toEqual({
      type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      code: "CCW6...MI75",
      issuer: { key: OTHER_CONTRACT },
    });
  });

  it("names and pictures the destination token from its descriptor", () => {
    const destination = {
      id: `DEST:${OTHER_CONTRACT}`,
      tokenCode: "DEST",
      issuer: OTHER_CONTRACT,
      iconUrl: "https://icons.example/dest.png",
    } as DestinationTokenDescriptor;
    const view = buildSwapRouteView({
      route: route([
        { share: "1", hops: [hop("Soroswap", "XLM", OTHER_CONTRACT, "p1")] },
      ]),
      protocols: PROTOCOLS,
      balanceItems: [],
      destination,
    });

    expect(view?.to.code).toBe("DEST");
    expect(view?.to.iconUrl).toBe("https://icons.example/dest.png");
  });
});
