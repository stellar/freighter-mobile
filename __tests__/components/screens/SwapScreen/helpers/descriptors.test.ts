import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
} from "components/screens/SwapScreen/helpers/descriptors";
import { TokenTypeWithCustomToken } from "config/types";

describe("descriptorFromBalance", () => {
  it("projects a native XLM balance", () => {
    const balance = {
      id: "native",
      tokenCode: "XLM",
      token: { type: "native", code: "XLM" },
      decimals: 7,
    } as any;

    expect(descriptorFromBalance(balance)).toEqual({
      id: "native",
      tokenCode: "XLM",
      issuer: undefined,
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.NATIVE,
      isNew: false,
    });
  });

  it("projects a classic balance", () => {
    const balance = {
      id: "USDC:GA5Z...",
      tokenCode: "USDC",
      token: {
        code: "USDC",
        issuer: { key: "GA5Z..." },
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      },
      decimals: 7,
    } as any;

    expect(descriptorFromBalance(balance)).toMatchObject({
      id: "USDC:GA5Z...",
      tokenCode: "USDC",
      issuer: "GA5Z...",
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      isNew: false,
    });
  });
});

describe("descriptorFromSearchRecord", () => {
  it("projects a classic search record with isNew=true when not held", () => {
    const record = {
      tokenCode: "USDC",
      issuer: "GA5Z...",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      decimals: 7,
      hasTrustline: false,
      domain: "centre.io",
    } as any;

    expect(descriptorFromSearchRecord(record)).toEqual({
      id: "USDC:GA5Z...",
      tokenCode: "USDC",
      issuer: "GA5Z...",
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      isNew: true,
    });
  });

  it("sets isNew=false when hasTrustline is true (already held)", () => {
    const record = {
      tokenCode: "USDC",
      issuer: "GA5Z...",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      decimals: 7,
      hasTrustline: true,
    } as any;

    expect(descriptorFromSearchRecord(record).isNew).toBe(false);
  });

  it("defaults decimals to 7 when not provided", () => {
    const record = {
      tokenCode: "USDC",
      issuer: "GA5Z...",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      hasTrustline: false,
    } as any;

    expect(descriptorFromSearchRecord(record).decimals).toBe(7);
  });

  it("carries securityLevel from the record (set by useSwapTokenLookup's bulk scan)", () => {
    const record = {
      tokenCode: "EVIL",
      issuer: "GBADGUY...",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      hasTrustline: false,
      securityLevel: SecurityLevel.MALICIOUS,
    } as any;

    expect(descriptorFromSearchRecord(record).securityLevel).toBe(
      SecurityLevel.MALICIOUS,
    );
  });
});
