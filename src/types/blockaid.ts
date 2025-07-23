export type SecurityStatus = "safe" | "warning" | "malicious" | "unknown";

export interface SecurityAlert {
  level: SecurityStatus;
  title: string;
  description: string;
  category: "info" | "warning" | "danger" | "success";
  message: string;
}

export interface ScanSiteParams {
  url: string;
}

export interface ScanAssetParams {
  assetCode: string;
  assetIssuer?: string;
  network: "public" | "testnet";
}

export interface ScanTxParams {
  xdr: string;
  sourceAccount: string;
  network: "public" | "testnet";
  url?: string;
}

// Base response structure from Blockaid API
interface BaseBlockaidResponse {
  status?: string;
  result_type?: string;
  malicious_score?: number | string;
  attack_types?: Record<string, unknown>;
  features?: Array<{
    feature_id: string;
    type: string;
    description: string;
  }>;
}

export interface SiteScanResponse extends BaseBlockaidResponse {
  url?: string;
  scan_start_time?: string;
  scan_end_time?: string;
  is_reachable?: boolean;
  is_web3_site?: boolean;
  is_malicious?: boolean;
  network_operations?: string[];
  json_rpc_operations?: string[];
  contract_write?: {
    contract_addresses: string[];
    functions: Record<string, unknown>;
  };
  contract_read?: {
    contract_addresses: string[];
    functions: Record<string, unknown>;
  };
  modals?: unknown[];
}

export interface SiteScanMissResponse {
  status: "miss";
}

export type BlockAidScanSiteResult = SiteScanResponse | SiteScanMissResponse;

export interface BlockAidScanAssetResult extends BaseBlockaidResponse {
  chain?: string;
  address?: string;
  metadata?: {
    type?: string | null;
    name?: string | null;
    symbol?: string | null;
    decimals?: number | null;
    image_url?: string | null;
    description?: string | null;
    deployer?: string | null;
    deployer_balance?: string | null;
    contract_balance?: string | null;
    owner_balance?: string | null;
    owner?: string | null;
    creation_timestamp?: string | null;
    external_links?: {
      homepage?: string | null;
      twitter_page?: string | null;
      telegram_channel_id?: string | null;
    };
    urls?: string[] | null;
    malicious_urls?: string[] | null;
    token_creation_initiator?: string | null;
  };
  fees?: {
    transfer?: number | null;
    transfer_fee_max_amount?: number | null;
    buy?: number | null;
    sell?: number | null;
  };
  trading_limits?: {
    max_buy?: number | null;
    max_sell?: number | null;
    max_holding?: number | null;
    sell_limit_per_block?: number | null;
  };
  financial_stats?: {
    supply?: string | null;
    holders_count?: number | null;
    usd_price_per_unit?: string | null;
    burned_liquidity_percentage?: number | null;
    locked_liquidity_percentage?: number | null;
    top_holders?: Array<{
      address: string;
      balance: string;
      percentage: number;
    }>;
    total_reserve_in_usd?: string | null;
  };
}

export interface BlockAidScanTxResult extends BaseBlockaidResponse {
  validation?: {
    status: SecurityStatus;
    warnings: SecurityAlert[];
    errors: SecurityAlert[];
  };
  simulation?: {
    status: SecurityStatus;
    account_summary: {
      account_exposures: Array<{
        asset: string;
        spender: string;
        amount: string;
      }>;
    };
  };
}

export interface BlockaidHookResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface TransactionSimulation {
  status: SecurityStatus;
  account_summary: {
    account_exposures: Array<{
      asset: string;
      spender: string;
      amount: string;
    }>;
  };
  accountExposures?: Array<{
    asset: string;
    spender: string;
    amount: string;
  }>;
}

export interface TransactionValidation {
  status: SecurityStatus;
  warnings: SecurityAlert[];
  errors: SecurityAlert[];
}

export interface BlockaidTransactionResult {
  simulation?: TransactionSimulation;
  validation: TransactionValidation;
  raw: BlockAidScanTxResult;
}
