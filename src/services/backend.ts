import { AssetType, Horizon } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { INDEXER_URL, NETWORKS } from "config/constants";
import { bigize } from "helpers/bigize";
import { createApiService } from "services/apiFactory";

// Create a dedicated API service for backend operations
export const backendApi = createApiService({
  baseURL: INDEXER_URL,
});

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

export type FetchBalancesResponse = {
  balances?: BalanceMap;
  isFunded?: boolean;
  subentryCount?: number;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  error?: { horizon: any; soroban: any };
  /* eslint-enable @typescript-eslint/no-explicit-any */
};

type FetchBalancesParams = {
  publicKey: string;
  network: NETWORKS;
  contractIds?: string[];
};

export const fetchBalances = async ({
  publicKey,
  network,
  contractIds,
}: FetchBalancesParams): Promise<FetchBalancesResponse> => {
  const params = new URLSearchParams({
    network,
  });

  if (contractIds?.length) {
    contractIds.forEach((id) => {
      params.append("contract_ids", id);
    });
  }

  const { data } = await backendApi.get<FetchBalancesResponse>(
    `/account-balances/${publicKey}?${params.toString()}`,
  );

  let bigizedBalances: BalanceMap | undefined;
  if (data.balances) {
    // transform properties that type declarations expect to be BigNumber
    // instead of number/string as it originally comes from the API
    bigizedBalances = bigize(data.balances, [
      "available",
      "total",
      "limit",
      "minimumBalance",
      "numAccounts",
      "amount",
      "bidCount",
      "askCount",
      "spread",
    ]);
  }

  return {
    ...data,
    balances: bigizedBalances || data.balances,
  };
};
