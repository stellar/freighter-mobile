import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
} from "components/screens/SwapScreen/helpers/descriptors";
import { TokenTypeWithCustomToken } from "config/types";
import {
  BLOCKAID_RESULT_TYPES,
  SecurityLevel,
} from "services/blockaid/constants";

describe("descriptorFromBalance", () => {
  it("projects a native XLM balance (canonical id is 'XLM', not 'native')", () => {
    // Accepts a balance with the legacy id="native" (from Horizon raw
    // response) — the helper canonicalises both forms to NATIVE_TOKEN_CODE
    // so the descriptor id matches the production balance store, which
    // converts native → XLM in services/backend.ts before storage.
    const balance = {
      id: "native",
      tokenCode: "XLM",
      token: { type: "native", code: "XLM" },
      decimals: 7,
    } as any;

    expect(descriptorFromBalance(balance)).toEqual({
      id: "XLM",
      tokenCode: "XLM",
      issuer: undefined,
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.NATIVE,
      isNew: false,
    });
  });

  it("projects a native XLM balance when id is already 'XLM' (production form)", () => {
    const balance = {
      id: "XLM",
      tokenCode: "XLM",
      token: { type: "native", code: "XLM" },
      decimals: 7,
    } as any;

    expect(descriptorFromBalance(balance).id).toBe("XLM");
  });

  it("projects a classic balance", () => {
    const balance = {
      id: "USDC:GA5Z...",
      tokenCode: "USDC",
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
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

  it("carries securityLevel from balance.blockaidData when present", () => {
    const balance = {
      id: "USDC:GA5Z...",
      tokenCode: "USDC",
      token: {
        code: "USDC",
        issuer: { key: "GA5Z..." },
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      },
      decimals: 7,
      blockaidData: { result_type: BLOCKAID_RESULT_TYPES.MALICIOUS },
    } as any;

    expect(descriptorFromBalance(balance).securityLevel).toBe(
      SecurityLevel.MALICIOUS,
    );
  });

  it("omits securityLevel when balance has no blockaidData", () => {
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

    expect(descriptorFromBalance(balance).securityLevel).toBeUndefined();
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
