import { computeTrendingIntersection } from "components/screens/SwapScreen/helpers/computeTrendingIntersection";
import { SearchTokenResponse } from "config/types";
import { TokenListReponseItem } from "services/verified-token-lists/types";

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const AQUA_ISSUER = "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA";
const FOO_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4FOOO";
const SOROBAN_CONTRACT =
  "CC64WBDGS6QQP22QTTIACYIXT3WF7BBQEYOQPLTP7GTKYY7PZ74QYGSL";

const buildTopTokensResp = (assets: string[]): SearchTokenResponse =>
  ({
    _embedded: { records: assets.map((asset) => ({ asset, domain: "" })) },
    _links: {
      self: { href: "" },
      prev: { href: "" },
      next: { href: "" },
    },
  }) as unknown as SearchTokenResponse;

const buildVerified = (issuers: string[]): TokenListReponseItem[] =>
  issuers.map(
    (issuer) =>
      ({ issuer, name: "", code: "", domain: "" }) as TokenListReponseItem,
  );

const noTrustline = () => false;

describe("computeTrendingIntersection", () => {
  it("keeps only classic records that intersect the verified list", () => {
    const top = buildTopTokensResp([
      `USDC-${USDC_ISSUER}-1`,
      `AQUA-${AQUA_ISSUER}-1`,
      `FOO-${FOO_ISSUER}-1`,
    ]);
    const verified = buildVerified([USDC_ISSUER, AQUA_ISSUER]);

    const result = computeTrendingIntersection(top, verified, noTrustline);
    const codes = result.map((r) => r.tokenCode).sort();
    expect(codes).toEqual(["AQUA", "USDC"]);
  });

  it("drops Soroban contract records", () => {
    const top = buildTopTokensResp([`USDC-${USDC_ISSUER}-1`, SOROBAN_CONTRACT]);
    const verified = buildVerified([USDC_ISSUER]);

    const result = computeTrendingIntersection(top, verified, noTrustline);
    expect(result).toHaveLength(1);
    expect(result[0].tokenCode).toBe("USDC");
  });

  it("dedupes by canonical CODE:ISSUER", () => {
    const top = buildTopTokensResp([
      `USDC-${USDC_ISSUER}-1`,
      `USDC-${USDC_ISSUER}-1`,
    ]);
    const verified = buildVerified([USDC_ISSUER]);

    const result = computeTrendingIntersection(top, verified, noTrustline);
    expect(result).toHaveLength(1);
  });

  it("always includes native XLM regardless of verified list contents", () => {
    const top = buildTopTokensResp(["XLM"]);
    const verified = buildVerified([]); // empty verified list
    const result = computeTrendingIntersection(top, verified, noTrustline);
    expect(result.map((r) => r.tokenCode)).toContain("XLM");
  });

  it("returns empty array when intersection is empty", () => {
    const top = buildTopTokensResp([`FOO-${FOO_ISSUER}-1`]);
    const verified = buildVerified([USDC_ISSUER]);
    const result = computeTrendingIntersection(top, verified, noTrustline);
    expect(result).toEqual([]);
  });

  it("flags hasTrustline=true on records matching the held-set callback", () => {
    const top = buildTopTokensResp([`USDC-${USDC_ISSUER}-1`]);
    const verified = buildVerified([USDC_ISSUER]);
    const held = (c: string, i: string) => c === "USDC" && i === USDC_ISSUER;
    const result = computeTrendingIntersection(top, verified, held);
    expect(result[0].hasTrustline).toBe(true);
  });
});
