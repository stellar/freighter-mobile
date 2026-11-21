import { Asset, Networks } from "@stellar/stellar-sdk";
import {
  buildEarnSwapDestination,
  getEarnOptionToken,
  parseCanonicalAsset,
} from "components/screens/EarnScreen/helpers";
import { EarnTokenOption } from "components/screens/EarnScreen/hooks/useEarnTokens";
import { BLEND_FIXED_POOL_IDS } from "config/blend";
import { NETWORKS } from "config/constants";

const makeOption = (over: Partial<EarnTokenOption> = {}): EarnTokenOption => ({
  assetId: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  code: "USDC",
  decimals: 7,
  total: "0",
  apy: 0.0651,
  poolId: BLEND_FIXED_POOL_IDS[NETWORKS.PUBLIC]!,
  canonicalId: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  isNative: false,
  balance: undefined,
  ...over,
});

describe("buildEarnSwapDestination", () => {
  // makeOption's assetId is mainnet USDC's SAC.
  const build = (option: EarnTokenOption) =>
    buildEarnSwapDestination(option, Networks.PUBLIC);

  it("splits the catalog's canonical id into code and issuer", () => {
    const result = build(makeOption());

    expect(result).toEqual({
      id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      tokenCode: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      decimals: 7,
      tokenType: "credit_alphanum4",
      requiresTrustline: true,
    });
  });

  it("describes native XLM without an issuer or a trustline", () => {
    const result = build(
      makeOption({ code: "XLM", isNative: true, canonicalId: null }),
    );

    expect(result).toMatchObject({
      id: "XLM",
      tokenCode: "XLM",
      tokenType: "native",
      requiresTrustline: false,
    });
    expect(result).not.toHaveProperty("issuer");
  });

  it("classifies codes longer than 4 characters as alphanum12", () => {
    expect(
      build(
        makeOption({
          code: "LONGCODE",
          assetId: new Asset(
            "LONGCODE",
            "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          ).contractId(Networks.PUBLIC),
          canonicalId:
            "LONGCODE:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        }),
      ),
    ).toMatchObject({ tokenType: "credit_alphanum12" });
  });

  it("reports no trustline requirement when the account already holds some", () => {
    expect(
      build(makeOption({ balance: { total: "0.0000001" } as never })),
    ).toMatchObject({ requiresTrustline: false });
  });

  // The swap must buy the token the pool takes. The catalog's canonical id is
  // backend data, so it counts only when it derives the pool's SAC address.
  describe("when the canonical id isn't the pool's asset", () => {
    it("returns null for another issuer's token with the same code", () => {
      expect(
        build(
          makeOption({
            canonicalId:
              "USDC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
          }),
        ),
      ).toBeNull();
    });

    it("returns null for another code from the same issuer", () => {
      expect(
        build(
          makeOption({
            canonicalId:
              "EURC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          }),
        ),
      ).toBeNull();
    });

    it("returns null on another network, whose SAC addresses differ", () => {
      expect(
        buildEarnSwapDestination(makeOption(), Networks.TESTNET),
      ).toBeNull();
    });

    it("returns null for a code too long to be an asset", () => {
      expect(
        build(
          makeOption({
            canonicalId:
              "THIRTEENCHARS:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          }),
        ),
      ).toBeNull();
    });
  });

  // A SAC address is a hash: it cannot be decomposed back into code + issuer,
  // so a non-native reserve the catalog left unnamed has no classic form. The
  // caller must treat null as "no swap path" -- falling back to `assetId`
  // would build a descriptor the path finder silently fails on.
  it("returns null for a non-native reserve with no canonical id", () => {
    expect(build(makeOption({ canonicalId: null }))).toBeNull();
  });

  it.each([
    ["no separator", "USDCGA5ZSEJY"],
    ["empty code", ":GA5ZSEJY"],
    ["empty issuer", "USDC:"],
    ["issuer that isn't an account key", "USDC:GISSUER"],
    [
      "contract address as issuer",
      "USDC:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    ],
  ])(
    "returns null for a malformed canonical id (%s)",
    (_label, canonicalId) => {
      expect(build(makeOption({ canonicalId }))).toBeNull();
    },
  );
});

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("parseCanonicalAsset", () => {
  it("splits a classic canonical id into code and issuer", () => {
    expect(parseCanonicalAsset(`USDC:${USDC_ISSUER}`)).toEqual({
      code: "USDC",
      issuer: USDC_ISSUER,
    });
  });

  it("rejects anything that isn't CODE:<account key>", () => {
    expect(parseCanonicalAsset(null)).toBeNull();
    expect(parseCanonicalAsset("USDC")).toBeNull();
    expect(parseCanonicalAsset(":GABC")).toBeNull();
    expect(parseCanonicalAsset("USDC:")).toBeNull();
    expect(parseCanonicalAsset("USDC:not-a-key")).toBeNull();
    // A contract id is not an issuer.
    expect(
      parseCanonicalAsset(
        "USDC:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      ),
    ).toBeNull();
  });
});

describe("getEarnOptionToken", () => {
  it("uses the held balance when there is one", () => {
    const balance = { token: { code: "USDC", issuer: { key: USDC_ISSUER } } };
    expect(getEarnOptionToken(makeOption({ balance } as never))).toBe(balance);
  });

  it("describes native XLM as native", () => {
    expect(
      getEarnOptionToken(
        makeOption({ code: "XLM", isNative: true, canonicalId: null }),
      ),
    ).toEqual({ type: "native", code: "XLM" });
  });

  // The icon cache keys a token as CODE:ISSUER with its classic issuer, so
  // a token keyed by its contract id never found its icon.
  it("keys a token the account doesn't hold by its classic issuer", () => {
    expect(getEarnOptionToken(makeOption())).toEqual({
      code: "USDC",
      issuer: { key: USDC_ISSUER },
    });
  });

  it("falls back to the contract id when the catalog gives no classic form", () => {
    const option = makeOption({ canonicalId: null });
    expect(getEarnOptionToken(option)).toEqual({
      code: "USDC",
      issuer: { key: option.assetId },
    });
  });
});
