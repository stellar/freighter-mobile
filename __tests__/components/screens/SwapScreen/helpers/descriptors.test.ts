/* eslint-disable @fnando/consistent-import/consistent-import */
import BigNumber from "bignumber.js";
import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
  resolveDestinationDisplayPrice,
  withDescriptorPrice,
} from "components/screens/SwapScreen/helpers/descriptors";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import {
  BLOCKAID_RESULT_TYPES,
  SecurityLevel,
} from "services/blockaid/constants";

import { CONTRACT } from "../../../../../__mocks__/swapFixtures";

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
      requiresTrustline: false,
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
      requiresTrustline: false,
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
  it("projects a classic search record with requiresTrustline=true when not held", () => {
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
      requiresTrustline: true,
    });
  });

  it("sets requiresTrustline=false when hasTrustline is true (already held)", () => {
    const record = {
      tokenCode: "USDC",
      issuer: "GA5Z...",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      decimals: 7,
      hasTrustline: true,
    } as any;

    expect(descriptorFromSearchRecord(record).requiresTrustline).toBe(false);
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

  describe("Soroban tokens", () => {
    it("builds a descriptor from a Soroban search record, with the contract where the issuer goes", () => {
      const descriptor = descriptorFromSearchRecord({
        tokenCode: "deJTRSY",
        name: "deJTRSY",
        domain: "",
        issuer: CONTRACT,
        isNative: false,
        tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        hasTrustline: true,
        decimals: 18,
        price: 1.02,
        iconUrl: "https://icons.example/dejtrsy.png",
      });

      expect(descriptor).toMatchObject({
        id: `deJTRSY:${CONTRACT}`,
        tokenCode: "deJTRSY",
        issuer: CONTRACT,
        decimals: 18,
        tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        requiresTrustline: false,
        priceUsd: 1.02,
        iconUrl: "https://icons.example/dejtrsy.png",
      });
    });

    it("builds a descriptor from a held Soroban balance", () => {
      const descriptor = descriptorFromBalance({
        id: `deJTRSY:${CONTRACT}`,
        tokenCode: "deJTRSY",
        tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        decimals: 18,
      } as any);

      expect(descriptor).toMatchObject({
        id: `deJTRSY:${CONTRACT}`,
        tokenCode: "deJTRSY",
        issuer: CONTRACT,
        decimals: 18,
        requiresTrustline: false,
      });
    });
  });
});

describe("resolveDestinationDisplayPrice", () => {
  const descriptor = {
    id: `deJTRSY:${CONTRACT}`,
    tokenCode: "deJTRSY",
    issuer: CONTRACT,
    decimals: 7,
    tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    requiresTrustline: false,
  };
  const priced = (price: string) =>
    ({ currentPrice: new BigNumber(price) }) as unknown as PricedBalance;

  const mapPrice = (price: string) =>
    ({ [descriptor.id]: { currentPrice: new BigNumber(price) } }) as never;
  const call = (
    overrides: Partial<Parameters<typeof resolveDestinationDisplayPrice>[0]>,
  ) =>
    resolveDestinationDisplayPrice({
      balance: undefined,
      prices: {},
      descriptor,
      ...overrides,
    });

  it.each([
    [
      "takes a held balance's own price first",
      { balance: priced("2"), prices: mapPrice("3") },
      new BigNumber("2"),
    ],
    [
      "takes the prices map when there is no held price",
      { prices: mapPrice("3") },
      new BigNumber("3"),
    ],
    [
      "skips a zero price at every step",
      { balance: priced("0"), prices: mapPrice("0") },
      undefined,
    ],
    ["is undefined when nothing prices the token", {}, undefined],
    [
      "is undefined without a descriptor to look the map up by",
      { descriptor: null, prices: mapPrice("3") },
      undefined,
    ],
  ])("%s", (_title, overrides, expected) => {
    expect(call(overrides)).toEqual(expected);
  });
});

describe("withDescriptorPrice", () => {
  const token = { id: `deJTRSY:${CONTRACT}`, priceUsd: 4 };

  it("adds the picker's price when the map has none", () => {
    expect(withDescriptorPrice({}, token)[token.id].currentPrice).toEqual(
      new BigNumber("4"),
    );
  });

  it("keeps a price the map already has", () => {
    const prices = {
      [token.id]: { currentPrice: new BigNumber("3") },
    } as never;

    expect(withDescriptorPrice(prices, token)).toBe(prices);
  });

  it("returns the same map when the picker carries no price", () => {
    const prices = {};

    expect(withDescriptorPrice(prices, { id: token.id })).toBe(prices);
    expect(withDescriptorPrice(prices, null)).toBe(prices);
  });
});
