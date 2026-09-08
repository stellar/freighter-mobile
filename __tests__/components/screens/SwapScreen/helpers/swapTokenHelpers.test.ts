import { BigNumber } from "bignumber.js";
import {
  calculateTokenFiatAmount,
  findBalanceForToken,
} from "components/screens/SwapScreen/helpers/swapTokenHelpers";
import { TokenTypeWithCustomToken, type PricedBalance } from "config/types";

const ISSUER_REAL = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const ISSUER_OTHER = "GBEO62ZYAOEKVL4WMF5Q6VYTOJQUT7H2QYRDVFO5LT4W7VQPFDWVKUHO";
const CONTRACT_A = "CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT";

const heldUsdc = {
  token: {
    type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: "USDC",
    issuer: { key: ISSUER_REAL },
  },
  total: new BigNumber("50"),
  tokenCode: "USDC",
  currentPrice: new BigNumber("1"),
} as unknown as PricedBalance;

const heldNative = {
  token: { type: "native", code: "XLM" },
  total: new BigNumber("100"),
  tokenCode: "XLM",
  currentPrice: new BigNumber("0.5"),
} as unknown as PricedBalance;

const heldSoroban = {
  token: { code: "FOO", issuer: { key: CONTRACT_A } },
  total: new BigNumber("5"),
  contractId: CONTRACT_A,
  tokenCode: "FOO",
  currentPrice: new BigNumber("2"),
} as unknown as PricedBalance;

const balanceItems = [heldUsdc, heldNative, heldSoroban];

describe("findBalanceForToken", () => {
  it("matches a held classic token by exact pair", () => {
    expect(
      findBalanceForToken({
        token: {
          type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
          code: "USDC",
          issuer: { key: ISSUER_REAL },
        },
        balanceItems,
      }),
    ).toBe(heldUsdc);
  });

  it("matches native", () => {
    expect(
      findBalanceForToken({
        token: { type: "native", code: "XLM" },
        balanceItems,
      }),
    ).toBe(heldNative);
  });

  it("matches a held contract token by symbol:contract pair", () => {
    expect(
      findBalanceForToken({
        token: { code: "FOO", issuer: { key: CONTRACT_A } },
        balanceItems,
      }),
    ).toBe(heldSoroban);
  });

  it("returns undefined for a same-code token with a different issuer", () => {
    expect(
      findBalanceForToken({
        token: {
          type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
          code: "USDC",
          issuer: { key: ISSUER_OTHER },
        },
        balanceItems,
      }),
    ).toBeUndefined();
  });
});

describe("calculateTokenFiatAmount", () => {
  it("never values a non-held token at a held same-code balance's price", () => {
    expect(
      calculateTokenFiatAmount({
        token: {
          type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
          code: "USDC",
          issuer: { key: ISSUER_OTHER },
        },
        amount: "10",
        balanceItems,
      }),
    ).toBe("--");
  });

  it("still values held tokens", () => {
    expect(
      calculateTokenFiatAmount({
        token: {
          type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
          code: "USDC",
          issuer: { key: ISSUER_REAL },
        },
        amount: "10",
        balanceItems,
      }),
    ).toBe("10");
  });

  it("can still price a non-held token from the prices map by exact identifier", () => {
    expect(
      calculateTokenFiatAmount({
        token: {
          type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
          code: "EURC",
          issuer: { key: ISSUER_OTHER },
        },
        amount: "10",
        balanceItems,
        prices: {
          [`EURC:${ISSUER_OTHER}`]: { currentPrice: new BigNumber("1.1") },
        },
      }),
    ).toBe("11");
  });
});
