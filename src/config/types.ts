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

/**
 * Token identifier string format:
 * - "XLM" for native tokens
 * - "CODE:ISSUER" for other assets (e.g., "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
 * - "LP_ID:lp" for liquidity pools (e.g., "4ac86c65b9f7b175ae0493da0d36cc5bc88b72677ca69fce8fe374233983d8e7:lp")
 */
export type TokenIdentifier = string;

export type BalanceMap = {
  [tokenIdentifier: TokenIdentifier]: Balance;
};

/**
 * Price data for a single token
 */
export interface TokenPrice {
  /** Current USD price of the token */
  currentPrice?: BigNumber | null;
  /** 24-hour percentage change in price (null if unavailable) */
  percentagePriceChange24h?: BigNumber | null;
}

/**
 * Map of token identifiers to their price information
 */
export interface TokenPricesMap {
  [tokenIdentifier: TokenIdentifier]: TokenPrice;
}

/**
 * Represents a balance with additional price and display information
 *
 * Extends the base Balance type with price data from TokenPrice and
 * adds display-related properties for UI rendering.
 *
 * @property {string} [tokenCode] - Short code representing the token (e.g., "XLM", "USDC")
 * @property {string} [fiatCode] - Currency code for fiat value display (e.g., "USD")
 * @property {BigNumber} [fiatTotal] - Total value of the balance in fiat currency
 * @property {string} [displayName] - Human-readable name for display purposes
 * @property {string} [firstChar] - First character or abbreviation for avatar/icon fallback
 * @property {string} [imageUrl] - URL to the token's icon or image
 */
export type PricedBalance = Balance &
  TokenPrice & {
    tokenCode?: string;
    fiatCode?: string;
    fiatTotal?: BigNumber;
    displayName?: string;
    firstChar?: string;
    imageUrl?: string;
  };

/**
 * Map of token identifiers to their priced balance information
 *
 * Used to store and access balance data with price information by token identifier.
 */
export type PricedBalanceMap = {
  [tokenIdentifier: TokenIdentifier]: PricedBalance;
};
