import { NETWORKS } from "config/constants";

export interface TokensListItem {
  url: string;
  isEnabled: boolean;
}

export type TokensLists = {
  [K in NETWORKS]: TokensListItem[];
};

export interface TokenListReponseItem {
  code: string;
  issuer: string;
  contract: string;
  org?: string; // org is not optional in the spec but lobstr list does not adhere in this case
  domain: string;
  icon: string;
  decimals: number;
  name?: string;
}

export interface TokenListResponse {
  name: string;
  description: string;
  network: string;
  version: string;
  provider: string;
  assets: TokenListReponseItem[];
}
