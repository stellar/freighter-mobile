import BigNumber from "bignumber.js";
import { PricedBalance } from "config/types";

export const ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
export const SENDER =
  "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
export const CONTRACT =
  "CBI7UCH5KGSVQRO5H4SUCZUTZABCITZLRHQQZTWL2TK4RZ72TAR6IHRV";
export const XLM_SAC =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
export const USDC_SAC =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

export const xlm = {
  id: "native",
  tokenCode: "XLM",
  token: { type: "native", code: "XLM" },
} as unknown as PricedBalance;

export const usdc = {
  id: `USDC:${ISSUER}`,
  tokenCode: "USDC",
  token: { type: "credit_alphanum4", code: "USDC", issuer: { key: ISSUER } },
} as unknown as PricedBalance;

export const soroban = (decimals: number) =>
  ({
    id: `deJTRSY:${CONTRACT}`,
    contractId: CONTRACT,
    symbol: "deJTRSY",
    decimals,
    total: new BigNumber(5),
    token: {
      type: "custom_token",
      code: "deJTRSY",
      issuer: { key: CONTRACT },
    },
  }) as unknown as PricedBalance;

export const dejtrsy = soroban(18);

/** The unsigned transaction `backendQuote()` carries. */
export const BACKEND_ENVELOPE = "envelope-2";

export const backendQuote = (over: Record<string, unknown> = {}) => ({
  source: "xoxno",
  sourceAmount: "10",
  destinationAmount: "2.2949042",
  destinationAmountMin: "2.2719551",
  destinationDecimals: 7,
  conversionRate: "0.2294904",
  networkFeeXlm: "0.0098024",
  transaction: {
    envelopeXdr: BACKEND_ENVELOPE,
    feeStroops: "98024",
    resourceFeeStroops: "97924",
    expiresAt: Math.floor(Date.now() / 1000) + 180,
  },
  ...over,
});
