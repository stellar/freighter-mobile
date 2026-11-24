import { canonicalId } from "components/screens/SwapScreen/helpers/canonicalId";

describe("canonicalId", () => {
  it("returns CODE:ISSUER when issuer is present", () => {
    expect(canonicalId("USDC", "GA5Z")).toBe("USDC:GA5Z");
  });

  it("returns just the code when issuer is an empty string", () => {
    expect(canonicalId("XLM", "")).toBe("XLM");
  });

  it("preserves case (Stellar identifiers are case-sensitive)", () => {
    expect(canonicalId("Usdc", "ga5z")).toBe("Usdc:ga5z");
  });

  it("keys a Soroban token by its contract ID alone", () => {
    const contractId =
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
    expect(canonicalId("ABC", contractId)).toBe(canonicalId("SYM", contractId));
  });
});
