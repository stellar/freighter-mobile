/* eslint-disable @typescript-eslint/naming-convention */
import { Networks } from "@stellar/stellar-sdk";

const PASSWORD_MIN_LENGTH = 8;

export { PASSWORD_MIN_LENGTH };

export const INDEXER_URL = "https://freighter-backend-prd.stellar.org/api/v1";

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

/**
 * Non-sensitive storage keys.
 *
 * ACTIVE_ACCOUNT The active account is the account that is currently being used.
 * ACCOUNT_LIST The account list is used to keep track of all the accounts stored in the key manager.
 * */
export enum STORAGE_KEYS {
  ACTIVE_ACCOUNT_ID = "activeAccountId",
  ACCOUNT_LIST = "accountList",
  HASH_KEY_EXPIRE_AT = "hashKeyExpireAt",
}

/**
 * Sensitive storage keys.
 *
 * TEMPORARY_STORE The temporary store contains encrypted private keys and mnemonic phrase.
 * HASH_KEY The hash key and salt in an JSON stryngified object. This is used to encrypt and decrypt the temporary store.
 * HASH_KEY format: { hashKey: string, salt: string }
 * */
export enum SENSITIVE_STORAGE_KEYS {
  TEMPORARY_STORE = "temporaryStore",
  HASH_KEY = "hashKey",
}

/**
 * Please ignore the below, it's being used for testing purposes
 */
// export const TEST_PUBLIC_KEY =
//   "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG";
// export const TEST_NETWORK_DETAILS = TESTNET_NETWORK_DETAILS;
// export const TEST_PUBLIC_KEY =
//   "GD7EMKA34FGOC32GMK53JRVRYU2A6F5SBXDSE3XIGUAO7ZE4IP3FIQRC";
// export const TEST_NETWORK_DETAILS = PUBLIC_NETWORK_DETAILS;
export const TEST_PUBLIC_KEY =
  "GB7CK4MCAJUYYI4K5IC6ZMTJBYMZXF5HDBUNMQXBILNX5NCS3S3T5OYH";
export const TEST_NETWORK_DETAILS = PUBLIC_NETWORK_DETAILS;
