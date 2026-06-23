import Blockaid from "@blockaid/client";
import { mergeBlockaidScans } from "components/screens/SwapScreen/helpers/mergeBlockaidScans";
import { FormattedSearchTokenRecord } from "config/types";
import { SecurityLevel } from "services/blockaid/constants";

const make = (tokenCode: string, issuer: string): FormattedSearchTokenRecord =>
  ({
    tokenCode,
    issuer,
    domain: "",
    hasTrustline: false,
    isNative: false,
  }) as FormattedSearchTokenRecord;

const buildScan = (
  result: "Benign" | "Malicious" | "Warning",
): Blockaid.Token.TokenScanResponse =>
  ({ result_type: result }) as Blockaid.Token.TokenScanResponse;

describe("mergeBlockaidScans", () => {
  it("applies a benign scan: securityLevel=SAFE, isMalicious=false", () => {
    const records = [make("USDC", "GA5Z")];
    const result = mergeBlockaidScans(records, {
      "USDC-GA5Z": buildScan("Benign"),
    });
    expect(result[0].securityLevel).toBe(SecurityLevel.SAFE);
    expect(result[0].isMalicious).toBe(false);
    expect(result[0].isSuspicious).toBe(false);
  });

  it("applies a malicious scan: securityLevel=MALICIOUS, isMalicious=true", () => {
    const records = [make("EVIL", "GBAD")];
    const result = mergeBlockaidScans(records, {
      "EVIL-GBAD": buildScan("Malicious"),
    });
    expect(result[0].securityLevel).toBe(SecurityLevel.MALICIOUS);
    expect(result[0].isMalicious).toBe(true);
  });

  it("leaves records without a matching scan as unable-to-scan", () => {
    const records = [make("USDC", "GA5Z"), make("AQUA", "GBN")];
    const result = mergeBlockaidScans(records, {
      "USDC-GA5Z": buildScan("Benign"),
    });
    expect(result[0].securityLevel).toBe(SecurityLevel.SAFE);
    expect(result[1].securityLevel).toBe(SecurityLevel.UNABLE_TO_SCAN);
    expect(result[1].isUnableToScan).toBe(true);
  });

  it("returns input untouched when scan map is empty", () => {
    const records = [make("USDC", "GA5Z")];
    const result = mergeBlockaidScans(records, {});
    expect(result[0].securityLevel).toBe(SecurityLevel.UNABLE_TO_SCAN);
  });

  it("preserves order and length", () => {
    const records = [make("A", "G1"), make("B", "G2"), make("C", "G3")];
    const result = mergeBlockaidScans(records, {
      "B-G2": buildScan("Malicious"),
    });
    expect(result.map((r) => r.tokenCode)).toEqual(["A", "B", "C"]);
  });

  it("propagates the debugOverride into assessTokenSecurity so dev tools work", () => {
    const records = [make("USDC", "GA5Z")];
    // Even with a benign scan, the override must take precedence.
    const result = mergeBlockaidScans(
      records,
      { "USDC-GA5Z": buildScan("Benign") },
      SecurityLevel.MALICIOUS,
    );
    expect(result[0].securityLevel).toBe(SecurityLevel.MALICIOUS);
    expect(result[0].isMalicious).toBe(true);
  });
});
