import { AssetType, Horizon } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { NETWORKS } from "config/constants";

export type Account = {
  id: string;
  name: string;
  publicKey: string;
  network: NETWORKS;
  imported?: boolean;
};

export type KeyPair = {
  publicKey: string;
  privateKey: string;
};

export type AssetTypeWithCustomToken = AssetType | "custom_token";

export enum NetworkCongestion {
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High",
}

export interface TemporaryStore {
  privateKeys: Record<string, string>;
  mnemonicPhrase: string;
}

export type HashKey = {
  hashKey: string;
  salt: string;
  expiresAt: number;
};

export const AUTH_STATUS = {
  // User is not authenticated. No hash key or temporary store found.
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  // User is authenticated. Hash key is not expired and temporary store is found.
  AUTHENTICATED: "AUTHENTICATED",
  // User is authenticated. Hash key is expired and temporary store is found.
  HASH_KEY_EXPIRED: "HASH_KEY_EXPIRED",
} as const;

export type AuthStatus = (typeof AUTH_STATUS)[keyof typeof AUTH_STATUS];

/**
 * Represents a native Stellar token (XLM)
 */
export type NativeToken = {
  type: AssetType.native;
  code: "XLM";
};

/**
 * Represents an asset issuer with their identifying information
 * @property {string} key - The public key of the issuer
 * @property {string} [name] - Optional display name of the issuer
 * @property {string} [url] - Optional website URL of the issuer
 * @property {string} [hostName] - Optional hostname for the issuer's domain
 */
export type Issuer = {
  key: string;
  name?: string;
  url?: string;
  hostName?: string;
};

/**
 * Represents a non-native Stellar asset with its properties
 * @property {string} code - The asset code (e.g., "USDC")
 * @property {Issuer} issuer - The asset issuer information
 */
export type AssetToken = {
  code: string;
  issuer: Issuer;
  type?: AssetTypeWithCustomToken;
  anchorAsset?: string;
  numAccounts?: BigNumber;
  amount?: BigNumber;
  bidCount?: BigNumber;
  askCount?: BigNumber;
  spread?: BigNumber;
};

/**
 * Base balance type with total amount
 * @property {BigNumber} total - The total balance amount
 */
export type BaseBalance = {
  total: BigNumber;
};

/**
 * Native XLM balance with available and minimum balance calculations
 * @property {BigNumber} available - Total minus selling liabilities and minimum balance
 * @property {BigNumber} minimumBalance - Required minimum XLM balance
 */
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

/**
 * Union type representing all possible balance types in the system
 * Includes native XLM, classic assets, Soroban tokens, and liquidity pools
 */
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

/**
 * Maps token identifiers to their respective balances
 * @example
 * {
 *   "XLM": { type: "native", total: "100", ... },
 *   "USDC:GA5Z...": { type: "classic", total: "50", ... }
 * }
 */
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
 */
export type PricedBalance = Balance &
  TokenPrice & {
    tokenCode?: string;
    id?: string;
    fiatCode?: string;
    fiatTotal?: BigNumber | null;
    displayName?: string;
  };

/**
 * Map of token identifiers to their priced balance information
 *
 * Used to store and access balance data with price information by token identifier.
 */
export type PricedBalanceMap = {
  [tokenIdentifier: TokenIdentifier]: PricedBalance;
};

export interface SearchAssetResponse {
  _links: {
    self: {
      href: string;
    };
    prev: {
      href: string;
    };
    next: {
      href: string;
    };
  };
  _embedded: {
    records: {
      asset: string;
      supply: number;
      traded_amount: number;
      payments_amount: number;
      created: number;
      trustlines: number[];
      payments: number;
      domain?: string;
      rating: {
        age: number;
        trades: number;
        payments: number;
        trustlines: number;
        volume7d: number;
        interop: number;
        liquidity: number;
        average: number;
      };
      score: number;
      paging_token: number;
    }[];
  };
}

export interface TokenDetailsResponse {
  name: string;
  decimals: number;
  symbol: string;
  balance?: string;
}

export interface GetTokenDetailsParams {
  contractId: string;
  publicKey: string;
  network: NETWORKS;
  shouldFetchBalance?: boolean;
}

export type FormattedSearchAssetRecord = {
  assetCode: string;
  domain: string;
  hasTrustline: boolean;
  issuer: string;
  isNative: boolean;
  assetType?: AssetTypeWithCustomToken;
};

/**
 * Custom token metadata for a single token
 */
export type CustomToken = {
  contractId: string;
  symbol: string;
};

/**
 * Storage structure for custom tokens, organized by publicKey -> network -> tokens
 * This allows efficiently storing and retrieving custom tokens for any account across networks
 */
export type CustomTokenStorage = {
  [publicKey: string]: {
    [network: string]: CustomToken[];
  };
};
