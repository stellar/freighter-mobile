import { AssetType, Horizon } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";

export type NativeToken = {
  type: AssetType.native;
  code: "XLM";
};

export type Issuer = {
  key: string;
  name?: string;
  url?: string;
  hostName?: string;
};

export type AssetToken = {
  code: string;
  issuer: Issuer;
  type?: AssetType;
  anchorAsset?: string;
  numAccounts?: BigNumber;
  amount?: BigNumber;
  bidCount?: BigNumber;
  askCount?: BigNumber;
  spread?: BigNumber;
};

export type BaseBalance = {
  total: BigNumber;
};

export type NativeBalance = BaseBalance & {
  token: NativeToken;
  // this should be total - sellingLiabilities - minimumBalance
  available: BigNumber;
  minimumBalance: BigNumber;
  buyingLiabilities: string;
  sellingLiabilities: string;

  // TODO: Handle blockaidData later once we add support for it
  // blockaidData: BlockAidScanAssetResult;
};

export type ClassicBalance = BaseBalance & {
  token: AssetToken;
  // this should be total - sellingLiabilities
  available: BigNumber;
  limit: BigNumber;
  buyingLiabilities: string;
  sellingLiabilities: string;
  sponsor?: string;

  // TODO: Handle blockaidData later once we add support for it
  // blockaidData: BlockAidScanAssetResult;
};

export type SorobanBalance = BaseBalance & {
  token: AssetToken;
  // this should be equal to total
  available: BigNumber;
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
};

// Liquidity Pool balances doesn't have a "token" property
// but rather a list of tokens under the reserves property
export type LiquidityPoolBalance = BaseBalance & {
  limit: BigNumber;
  liquidityPoolId: string;
  reserves: Horizon.HorizonApi.Reserve[];
};

export type Balance =
  | NativeBalance
  | ClassicBalance
  | SorobanBalance
  | LiquidityPoolBalance;

export type BalanceMap = {
  [balanceIdentifier: string]: Balance;
  native: NativeBalance;
};

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
