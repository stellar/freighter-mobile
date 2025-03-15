/* eslint-disable @typescript-eslint/naming-convention */
import { Networks } from "@stellar/stellar-sdk";

const PASSWORD_MIN_LENGTH = 8;

export { PASSWORD_MIN_LENGTH };

export const INDEXER_URL = "https://freighter-backend.stellar.org/api/v1";
export const TOKEN_PRICES_URL =
  "https://freighter-backend-dev.kube001-dev.services.stellar-ops.com/api/v1/token-prices";

export enum FRIENDBOT_URLS {
  TESTNET = "https://friendbot.stellar.org",
  FUTURENET = "https://friendbot-futurenet.stellar.org",
}

export enum NETWORKS {
  PUBLIC = "PUBLIC",
  TESTNET = "TESTNET",
  FUTURENET = "FUTURENET",
}

// Keys should match NETWORKS keys
export enum NETWORK_NAMES {
  PUBLIC = "Main Net",
  TESTNET = "Test Net",
  FUTURENET = "Future Net",
}

// Keys should match NETWORKS keys
export enum NETWORK_URLS {
  PUBLIC = "https://horizon.stellar.org",
  TESTNET = "https://horizon-testnet.stellar.org",
  FUTURENET = "https://horizon-futurenet.stellar.org",
}

// Keys should match NETWORKS keys
export enum SOROBAN_RPC_URLS {
  PUBLIC = "http://soroban-rpc-pubnet-prd.soroban-rpc-pubnet-prd.svc.cluster.local:8000",
  TESTNET = "https://soroban-testnet.stellar.org/",
  FUTURENET = "https://rpc-futurenet.stellar.org/",
}

export type NetworkDetails = {
  network: NETWORKS;
  networkName: NETWORK_NAMES;
  networkUrl: NETWORK_URLS;
  networkPassphrase: Networks;
  friendbotUrl?: FRIENDBOT_URLS;
  sorobanRpcUrl?: SOROBAN_RPC_URLS;
};

export const PUBLIC_NETWORK_DETAILS: NetworkDetails = {
  network: NETWORKS.PUBLIC,
  networkName: NETWORK_NAMES.PUBLIC,
  networkUrl: NETWORK_URLS.PUBLIC,
  networkPassphrase: Networks.PUBLIC,
  sorobanRpcUrl: SOROBAN_RPC_URLS.PUBLIC,
};

export const TESTNET_NETWORK_DETAILS: NetworkDetails = {
  network: NETWORKS.TESTNET,
  networkName: NETWORK_NAMES.TESTNET,
  networkUrl: NETWORK_URLS.TESTNET,
  networkPassphrase: Networks.TESTNET,
  friendbotUrl: FRIENDBOT_URLS.TESTNET,
  sorobanRpcUrl: SOROBAN_RPC_URLS.TESTNET,
};

export const FUTURENET_NETWORK_DETAILS: NetworkDetails = {
  network: NETWORKS.FUTURENET,
  networkName: NETWORK_NAMES.FUTURENET,
  networkUrl: NETWORK_URLS.FUTURENET,
  networkPassphrase: Networks.FUTURENET,
  friendbotUrl: FRIENDBOT_URLS.FUTURENET,
  sorobanRpcUrl: SOROBAN_RPC_URLS.FUTURENET,
};

export const DEFAULT_NETWORKS: Array<NetworkDetails> = [
  PUBLIC_NETWORK_DETAILS,
  TESTNET_NETWORK_DETAILS,
];
