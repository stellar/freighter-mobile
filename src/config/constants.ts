/* eslint-disable @typescript-eslint/naming-convention */
import { Networks } from "@stellar/stellar-sdk";
import { pxValue } from "helpers/dimensions";

export const DEFAULT_PADDING = pxValue(24);
export const DEFAULT_DEBOUNCE_DELAY = 500;
export const DEFAULT_RECOMMENDED_STELLAR_FEE = "100";

// Transaction fee constants
export const NATIVE_TOKEN_CODE = "XLM";
export const TRANSACTION_RECOMMENDED_FEE = "0.0250005";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 32;
export const ACCOUNT_NAME_MIN_LENGTH = 1;
export const ACCOUNT_NAME_MAX_LENGTH = 24;
export const ACCOUNTS_TO_VERIFY_ON_EXISTING_MNEMONIC_PHRASE = 5;
export const HASH_KEY_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const VISUAL_DELAY_MS = 500;

export const DEFAULT_DECIMALS = 7;

export const FREIGHTER_BACKEND_URL =
  "https://freighter-backend-prd.stellar.org/api/v1";
export const CREATE_ACCOUNT_URL =
  "https://developers.stellar.org/docs/tutorials/create-account/#create-account";

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

export const DEFAULT_TRANSACTION_TIMEOUT = 180;

export const DEFAULT_NETWORKS: Array<NetworkDetails> = [
  PUBLIC_NETWORK_DETAILS,
  TESTNET_NETWORK_DETAILS,
];

export const STELLAR_EXPERT_URL = "https://stellar.expert/explorer";
export const STELLAR_EXPERT_API_URL = "https://api.stellar.expert/explorer";

export const mapNetworkToNetworkDetails = (network: NETWORKS) => {
  switch (network) {
    case NETWORKS.PUBLIC:
      return PUBLIC_NETWORK_DETAILS;
    case NETWORKS.TESTNET:
      return TESTNET_NETWORK_DETAILS;
    case NETWORKS.FUTURENET:
      return FUTURENET_NETWORK_DETAILS;
    default:
      return PUBLIC_NETWORK_DETAILS;
  }
};

/**
 * Non-sensitive storage keys.
 *
 * ACTIVE_ACCOUNT The active account is the account that is currently being used.
 * ACCOUNT_LIST The account list is used to keep track of all the accounts stored in the key manager.
 * CUSTOM_TOKEN_LIST The custom token list is used to keep track of all the custom soroban tokens stored in the key manager.
 * Formatted as: { [publicKey: string]: { [network: string]: CustomToken[] } } @see CustomTokenStorage
 * The CUSTOM_TOKEN_LIST is not removed during the logout process. It is used to keep the custom tokens even after the user logs out, since the API does not store custom tokens.
 * ACTIVE_NETWORK The active network is the network that is currently being used.
 * */
export enum STORAGE_KEYS {
  ACTIVE_ACCOUNT_ID = "activeAccountId",
  ACCOUNT_LIST = "accountList",
  CUSTOM_TOKEN_LIST = "customTokenList",
  ACTIVE_NETWORK = "activeNetwork",
}

/**
 * Sensitive storage keys.
 *
 * TEMPORARY_STORE The temporary store contains encrypted private keys and mnemonic phrase.
 * HASH_KEY The hash key and salt in an JSON stryngified object. This is used to encrypt and decrypt the temporary store.
 * HASH_KEY format: { hashKey: string, salt: string, expiresAt: number }
 * */
export enum SENSITIVE_STORAGE_KEYS {
  TEMPORARY_STORE = "temporaryStore",
  HASH_KEY = "hashKey",
}
