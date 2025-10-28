/* eslint-disable @typescript-eslint/naming-convention */
import { Networks } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { getAppVersion } from "helpers/version";
import { t } from "i18next";
import { BIOMETRY_TYPE } from "react-native-keychain";

export const APP_VERSION = getAppVersion();

export const DEFAULT_PADDING = 24;

export enum Comparison {
  SAME = 0,
  LOWER = -1,
  GREATER = 1,
}
export const DEFAULT_ICON_SIZE = 24;
export const DEFAULT_DEBOUNCE_DELAY = 500;
export const DEFAULT_RECOMMENDED_STELLAR_FEE = "100";
export const POSITIVE_PRICE_CHANGE_THRESHOLD = new BigNumber(0.0099999);

export const TOGGLE_ANIMATION_DURATION = 400;

// This is used to prevent rows from highlighting when the user is scrolling
export const DEFAULT_PRESS_DELAY = 100;

export const DEFAULT_BLOCKAID_SCAN_DELAY = 1000;

// This is used to prevent flickering while refreshing lists with "pull to refresh" action
export const DEFAULT_REFRESH_DELAY = 1000;

// Balances polling interval in milliseconds
export const BALANCES_FETCH_POLLING_INTERVAL = 60000;

// History polling interval in milliseconds
export const HISTORY_FETCH_POLLING_INTERVAL = 30000;

// Transaction fee constants
export const NATIVE_TOKEN_CODE = "XLM";
export const MIN_TRANSACTION_FEE = "0.00001";
export const BASE_RESERVE = BigNumber(0.5);
export const MAX_MEMO_BYTES = 28;

// Slippage constants
export const DEFAULT_SLIPPAGE = 1;
export const MIN_SLIPPAGE = 0;
export const MAX_SLIPPAGE = 10;

// Transaction settings
export enum TransactionSetting {
  Memo = "memo",
  Slippage = "slippage",
  Fee = "fee",
  Timeout = "timeout",
}

export enum TransactionContext {
  Swap = "swap",
  Send = "send",
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 2048;
export const ACCOUNT_NAME_MIN_LENGTH = 1;
export const ACCOUNT_NAME_MAX_LENGTH = 24;
export const ACCOUNTS_TO_VERIFY_ON_EXISTING_MNEMONIC_PHRASE = 5;
export const HASH_KEY_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const VISUAL_DELAY_MS = 500;

// Recovery phrase validation constants
export const VALIDATION_WORDS_PER_ROW: number = 3;
export const VALIDATION_EXTRA_USER_WORDS: number = 2;
export const VALIDATION_DECOY_WORDS: number = 6;

export const DEFAULT_DECIMALS = 7;
export const FIAT_DECIMALS = 2;

// Bottom sheet layout defaults
export const BOTTOM_SHEET_MAX_HEIGHT_RATIO = 0.9;
export const BOTTOM_SHEET_CONTENT_TOP_PADDING = DEFAULT_PADDING;
export const BOTTOM_SHEET_CONTENT_BOTTOM_PADDING = 64;
export const BOTTOM_SHEET_CONTENT_GAP = 16;

// settings screen URLs
export const FREIGHTER_BASE_URL = "https://www.freighter.app";
export const FREIGHTER_DISCORD_URL = "https://discord.gg/rtXyAXPHYT";
export const FREIGHTER_GITHUB_ISSUE_URL =
  "https://github.com/stellar/freighter-mobile/issues";
export const STELLAR_FOUNDATION_BASE_URL = "https://stellar.org";
export const STELLAR_FOUNDATION_TERMS_URL =
  "https://stellar.org/terms-of-service";
export const STELLAR_FOUNDATION_PRIVACY_URL =
  "https://stellar.org/privacy-policy";

export const CREATE_ACCOUNT_TUTORIAL_URL =
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
  PUBLIC = "http://stellar-rpc-pubnet-prd:8000",
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

export enum OPERATION_TYPES {
  accountMerge = "Account Merge",
  allowTrust = "Allow Trust",
  beginSponsoringFutureReserves = "Begin Sponsoring Future Reserves",
  bumpSequence = "Bump Sequence",
  changeTrust = "Change Trust",
  claimClaimableBalance = "Claim Claimable Balance",
  clawback = "Clawback",
  clawbackClaimableBalance = "Clawback Claimable Balance",
  createAccount = "Create Account",
  createClaimableBalance = "Create Claimable Balance",
  createPassiveSellOffer = "Create Passive Sell Offer",
  endSponsoringFutureReserves = "End Sponsoring Future Reserves",
  extendFootprintTtl = "Extend Footprint TTL",
  inflation = "Inflation",
  invokeHostFunction = "Invoke Host Function",
  liquidityPoolDeposit = "Liquidity Pool Deposit",
  liquidityPoolWithdraw = "Liquidity Pool Withdraw",
  manageBuyOffer = "Manage Buy Offer",
  manageData = "Manage Data",
  manageSellOffer = "Manage Sell Offer",
  pathPaymentStrictReceive = "Path Payment Strict Receive",
  pathPaymentStrictSend = "Path Payment Strict Send",
  payment = "Payment",
  revokeAccountSponsorship = "Revoke Account Sponsorship",
  revokeClaimableBalanceSponsorship = "Revoke Claimable Balance Sponsorship",
  revokeDataSponsorship = "Revoke Data Sponsorship",
  revokeOfferSponsorship = "Revoke Offer Sponsorship",
  revokeSignerSponsorship = "Revoke Signer Sponsorship",
  revokeSponsorship = "Revoke Sponsorship",
  revokeTrustlineSponsorship = "Revoke Trustline Sponsorship",
  setOptions = "Set Options",
  setTrustLineFlags = "Set Trustline Flags",
  bumpFootprintExpiration = "Bump Footprint Expiration",
  restoreFootprint = "Restore Footprint",
}

export enum CLAIM_PREDICATES {
  claimPredicateUnconditional = t(
    "signTransactionDetails.claimPredicates.unconditional",
  ),
  claimPredicateConditional = t(
    "signTransactionDetails.claimPredicates.conditional",
  ),
  claimPredicateAnd = t("signTransactionDetails.claimPredicates.and"),
  claimPredicateOr = t("signTransactionDetails.claimPredicates.or"),
  claimPredicateNot = t("signTransactionDetails.claimPredicates.not"),
  claimPredicateBeforeRelativeTime = t(
    "signTransactionDetails.claimPredicates.beforeRelativeTime",
  ),
  claimPredicateBeforeAbsoluteTime = t(
    "signTransactionDetails.claimPredicates.beforeAbsoluteTime",
  ),
}

export const DEFAULT_TRANSACTION_TIMEOUT = 180;
export const MIN_TRANSACTION_TIMEOUT = 1;
export const MIN_IOS_VERSION_FOR_ATT_REQUEST = 14.5;

export enum SWAP_SELECTION_TYPES {
  SOURCE = "source",
  DESTINATION = "destination",
}

export const DEFAULT_NETWORKS: Array<NetworkDetails> = [
  PUBLIC_NETWORK_DETAILS,
  TESTNET_NETWORK_DETAILS,
];

export const STELLAR_EXPERT_URL = "https://stellar.expert/explorer";
export const STELLAR_EXPERT_API_URL = "https://api.stellar.expert/explorer";
export const BLOCKAID_FEEDBACK_URL = "https://report.blockaid.io/";

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
 *
 * CUSTOM_TOKEN_LIST The custom token list is used to keep track of all the custom soroban tokens stored in the key manager.
 * Formatted as: { [publicKey: string]: { [network: string]: CustomToken[] } } @see CustomTokenStorage
 * The CUSTOM_TOKEN_LIST is not removed during the logout process. It is used to keep the custom tokens even after the user logs out, since the API does not store custom tokens.
 *
 * COLLECTIBLES_LIST The collectibles list is used to keep track of all the collectibles stored in the key manager.
 * Formatted as: { [publicKey: string]: { [network: string]: CollectibleContract[] } } @see CollectiblesStorage
 * The COLLECTIBLES_LIST is not removed during the logout process. It is used to keep the collectibles even after the user logs out, since the API does not store collectibles.
 *
 * ACTIVE_NETWORK The active network is the network that is currently being used.
 * RECENT_ADDRESSES The list of recently used addresses for sending payments.
 *
 * APP_UPDATE_DISMISSED_REQUIRED_VERSION The version that the user has dismissed the app update notice for.
 * This is used to prevent the app update full screen notice from being shown again after the user has dismissed it.
 * It stores the version that the user has dismissed the notice for so it can be shown again if the user updates to a new version and falls behind again in the future.
 *
 * NOTE: we also have the BACKEND_V1_ENVIRONMENT and BACKEND_V2_ENVIRONMENT storage keys for the backend environment which are
 * handled separately in the backendConfig.ts file since those shouldn't be cleared or changed without the user's consent.
 * */
export enum STORAGE_KEYS {
  ACTIVE_ACCOUNT_ID = "activeAccountId",
  ACCOUNT_LIST = "accountList",
  CUSTOM_TOKEN_LIST = "customTokenList",
  COLLECTIBLES_LIST = "collectiblesList",
  ACTIVE_NETWORK = "activeNetwork",
  RECENT_ADDRESSES = "recentAddresses",
  MEMO_REQUIRED_ACCOUNTS = "memoRequiredAccounts",
  WELCOME_BANNER_SHOWN_PREFIX = "welcomeBanner_shown_",
  HAS_SEEN_BIOMETRICS_ENABLE_SCREEN = "hasSeenBiometricsEnableScreen",
  APP_UPDATE_DISMISSED_REQUIRED_VERSION = "appUpdateDismissedRequiredVersion",
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

/**
 * Biometric storage keys.
 *
 * BIOMETRIC_PASSWORD The biometric password is used to store the biometric protected password.
 * This key is used to securely store the user's password in the device's secure storage
 * (Keychain on iOS, Keystore on Android) for biometric authentication.
 * */
export enum BIOMETRIC_STORAGE_KEYS {
  BIOMETRIC_PASSWORD = "biometricPassword",
}

export enum TRANSACTION_WARNING {
  memoRequired = "memo-required",
}

// Browser constants
export const BROWSER_CONSTANTS = {
  HOMEPAGE_URL: "freighter://discovery-homepage",
  GOOGLE_SEARCH_BASE_URL: "https://www.google.com/search?q=",
  DEFAULT_TAB_TITLE: t("discovery.defaultTabTitle"),
  SCREENSHOT_STORAGE_KEY: "browser_screenshots",
  MAX_RECENT_TABS: 20,
  MAX_SCREENSHOTS_STORED: 100,
  MAX_ACTIVE_WEBVIEWS: 10, // Maximum number of active WebView instances
  SCREENSHOT_FORMAT: "jpg",
  SCREENSHOT_QUALITY: 0.5,
  SCREENSHOT_WIDTH: 400,
  SCREENSHOT_HEIGHT: 600,
  SCREENSHOT_ON_LOAD_DELAY: 500, // Take screenshot after site finishes loading
  SCREENSHOT_SCROLL_DELAY: 1000, // Take screenshot after 1s of no-scrolling
  SCREENSHOT_FINAL_DELAY: 2000, // Take screenshot after site animations complete
  // BLUR STRNGTH NEEDS TO BE ODD NUMBERS, IE 15, 25, 35, 55, 75, 95, etc.
  SCREENSHOT_BLUR_STRENGTH: {
    LIGHT: 15,
    MEDIUM: 25,
    STRONG: 35,
    VERY_STRONG: 55,
    EXTREMELY_STRONG: 151,
  },
  TAB_OPEN_ANIMATION_DURATION: 200,
  TAB_CLOSE_ANIMATION_DURATION: 200,
  TAB_SWITCH_SPINNER_DELAY: 500,
  TAB_SWITCH_SPINNER_DURATION: 200,
  TAB_PREVIEW_FAVICON_SIZE: 32,
  TAB_PREVIEW_CLOSE_ICON_SIZE: 14,
  TAB_PREVIEW_TILE_SIZE: "w-[47.7%] h-[202px]",

  // dApps work differently depending on the user agent, let's use the below for consistent behavior
  DISCOVERY_USER_AGENT: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1 FreighterMobile/${APP_VERSION}`,
} as const;

/**
 * Biometric login types for authentication
 *
 * These types represent the different authentication methods available to users:
 * - FACE: Face ID or face recognition authentication
 * - FINGERPRINT: Touch ID or fingerprint authentication
 * - PASSWORD: Traditional password-based authentication
 *
 * The type is determined by the device's biometric capabilities and user preferences.
 */
export enum LoginType {
  FACE = "face",
  FINGERPRINT = "fingerprint",
  PASSWORD = "password",
}

/**
 * Array of biometry types that correspond to Face ID authentication
 *
 * This includes both the specific Face ID type and the generic face biometry type
 */
export const FACE_ID_BIOMETRY_TYPES = [
  BIOMETRY_TYPE.FACE_ID,
  BIOMETRY_TYPE.FACE,
];

/**
 * Array of biometry types that correspond to fingerprint authentication
 *
 * This includes both Touch ID (iOS) and generic fingerprint types to support
 */
export const FINGERPRINT_BIOMETRY_TYPES = [
  BIOMETRY_TYPE.FINGERPRINT,
  BIOMETRY_TYPE.TOUCH_ID,
];

/**
 * QR Code Context Constants
 *
 * Defines the different contexts/sources where QR code scanning can be used.
 * This helps maintain type safety and avoid loose strings throughout the app.
 */
export enum QRCodeSource {
  /** For scanning addresses in Send flow */
  ADDRESS_INPUT = "address_input",
  /** For scanning WalletConnect URIs */
  WALLET_CONNECT = "wallet_connect",
  /** For scanning wallet import data */
  IMPORT_WALLET = "import_wallet",
}

/**
 * Type for QR code source values
 */
export type QRCodeSourceType = `${QRCodeSource}`;

/**
 * QR Code validation result types
 */
export enum QRCodeType {
  STELLAR_ADDRESS = "stellar_address",
  UNKNOWN = "unknown",
}

/**
 * QR Code validation error types
 */
export enum QRCodeError {
  SELF_SEND = "self_send",
  INVALID_FORMAT = "invalid_format",
}

/**
 * QR Code validation result interface
 */

/**
 * Biometrics Enable Screen Source Constants
 *
 * Defines the different sources/contexts where the biometrics enable screen can be used.
 * This helps maintain type safety and avoid loose strings throughout the app.
 */
export enum BiometricsSource {
  /** For importing an existing wallet */
  IMPORT_WALLET = "import_wallet",
  /** For new user onboarding flow */
  ONBOARDING = "onboarding",
  /** For post-onboarding flow (existing users) */
  POST_ONBOARDING = "post_onboarding",
}

/**
 * Type for biometrics source values
 */
export type BiometricsSourceType = `${BiometricsSource}`;

/**
 * Helper function to check if a string is a valid QR code source
 */
export const isValidQRCodeSource = (
  source: string,
): source is QRCodeSourceType =>
  Object.values(QRCodeSource).includes(source as QRCodeSource);

/**
 * Helper function to get the default QR code source
 */
export const getDefaultQRCodeSource = (): QRCodeSource =>
  QRCodeSource.ADDRESS_INPUT;
