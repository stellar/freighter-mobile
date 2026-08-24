import { buildEarnSwapDestination } from "components/screens/EarnScreen/helpers";
import { EarnTokenOption } from "components/screens/EarnScreen/hooks/useEarnTokens";

const makeOption = (over: Partial<EarnTokenOption> = {}): EarnTokenOption => ({
  assetId: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  code: "USDC",
  decimals: 7,
  total: "0",
  apy: 0.0651,
  poolId: "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD",
  canonicalId: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  isNative: false,
  balance: undefined,
  ...over,
});

describe("buildEarnSwapDestination", () => {
  it("splits the catalog's canonical id into code and issuer", () => {
    const result = buildEarnSwapDestination(makeOption());

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
    const result = buildEarnSwapDestination(
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
      buildEarnSwapDestination(
        makeOption({ code: "LONGCODE", canonicalId: "LONGCODE:GISSUER" }),
      ),
    ).toMatchObject({ tokenType: "credit_alphanum12" });
  });

  it("reports no trustline requirement when the account already holds some", () => {
    expect(
      buildEarnSwapDestination(
        makeOption({ balance: { total: "0.0000001" } as never }),
      ),
    ).toMatchObject({ requiresTrustline: false });
  });

  // A SAC address is a hash: it cannot be decomposed back into code + issuer,
  // so a non-native reserve the catalog left unnamed has no classic form. The
  // caller must treat null as "no swap path" -- falling back to `assetId`
  // would build a descriptor the path finder silently fails on.
  it("returns null for a non-native reserve with no canonical id", () => {
    expect(
      buildEarnSwapDestination(makeOption({ canonicalId: null })),
    ).toBeNull();
  });

  it.each([
    ["no separator", "USDCGA5ZSEJY"],
    ["empty code", ":GA5ZSEJY"],
    ["empty issuer", "USDC:"],
  ])(
    "returns null for a malformed canonical id (%s)",
    (_label, canonicalId) => {
      expect(buildEarnSwapDestination(makeOption({ canonicalId }))).toBeNull();
    },
  );
});
