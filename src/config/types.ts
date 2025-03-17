import { AssetType, Horizon } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";

export type NativeToken = {
  type: AssetType;
  code: string;
};

export type Issuer = {
  key: string;
  name?: string;
  url?: string;
  hostName?: string;
};

export type AssetToken = {
  type: AssetType;
  code: string;
  issuer: Issuer;
  anchorAsset?: string;
  numAccounts?: BigNumber;
  amount?: BigNumber;
  bidCount?: BigNumber;
  askCount?: BigNumber;
  spread?: BigNumber;
};

export type BaseBalance = {
  total: BigNumber;

  // for non-native tokens, this should be total - sellingLiabilities
  // for native, it should also subtract the minimumBalance
  // for liquidity pools, it doesn't exist
  available?: BigNumber;

  // for liquidity pools, this doesn't exist
  buyingLiabilities?: string;
  sellingLiabilities?: string;
  contractId?: string;

  // TODO: handle blockaidData later when we add support for it
  // blockaidData: BlockAidScanAssetResult;
};

// Liquidity Pool balances doesn't have a "token" property
export type LiquidityPoolBalance = BaseBalance & {
  limit: BigNumber;
  liquidityPoolId: string;
  reserves: Horizon.HorizonApi.Reserve[];
};

export type NativeBalance = BaseBalance & {
  token: NativeToken;
  minimumBalance: BigNumber;
};

export type AssetBalance = BaseBalance & {
  token: AssetToken;
  limit: BigNumber;
  sponsor?: string;
};

export type TokenBalance = AssetBalance & {
  name: string;
  symbol: string;
  decimals: number;
};

export type BalanceMap = {
  [balanceIdentifier: string]: Balance;
  native: NativeBalance;
};

export type Balance =
  | AssetBalance
  | TokenBalance
  | NativeBalance
  | LiquidityPoolBalance;

/**
 * Price data for a single token
 */
export interface TokenPrice {
  /** Current USD price of the token */
  currentPrice: BigNumber | null;
  /** 24-hour percentage change in price (null if unavailable) */
  percentagePriceChange24h: BigNumber | null;
}

/**
 * Token identifier string format:
 * - "XLM" for native tokens
 * - "CODE:ISSUER" for other assets (e.g., "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
 */
export type TokenIdentifier = string;

/**
 * Map of token identifiers to their price information
 */
export interface TokenPricesMap {
  [tokenIdentifier: TokenIdentifier]: TokenPrice;
}
