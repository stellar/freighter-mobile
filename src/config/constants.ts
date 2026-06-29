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

/** Display duration (ms) for error toasts surfaced from auth/account flows. */
export const ERROR_TOAST_DURATION = 6000;

// This is used to prevent rows from highlighting when the user is scrolling
export const DEFAULT_PRESS_DELAY = 100;

export const DEFAULT_BLOCKAID_SCAN_DELAY = 1000;

// This is used to prevent flickering while refreshing lists with "pull to refresh" action
export const DEFAULT_REFRESH_DELAY = 1000;

// Balances polling interval in milliseconds
export const BALANCES_FETCH_POLLING_INTERVAL = 30000;

// History polling interval in milliseconds
export const HISTORY_FETCH_POLLING_INTERVAL = 30000;

// Transaction fee constants
export const NATIVE_TOKEN_CODE = "XLM";
/**
 * Horizon's wire string for the native (XLM) asset's `asset_type` / `id`.
 * Distinct from `NATIVE_TOKEN_CODE` ("XLM"): raw Horizon responses use
 * "native", but normalized surfaces use "XLM". Prefer the
 * {@link isNativeAssetId} guard over comparing to either sentinel directly.
 */
export const HORIZON_NATIVE_ASSET_TYPE = "native";

/**
 * True if `id` refers to native XLM, matching both Horizon's raw "native"
 * sentinel and the normalized NATIVE_TOKEN_CODE ("XLM").
 */
export const isNativeAssetId = (id: string | undefined | null): boolean =>
  id === HORIZON_NATIVE_ASSET_TYPE || id === NATIVE_TOKEN_CODE;
export const MIN_TRANSACTION_FEE = "0.00001";
export const BASE_RESERVE = BigNumber(0.5);
export const MINIMUM_CREATE_ACCOUNT_XLM = 1;
export const MAX_MEMO_BYTES = 28;

// Circle USDC constants for icon special casing
export const CIRCLE_USDC_ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
export const USDC_CODE = "USDC";
export const CIRCLE_USDC_CONTRACT =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

// Slippage constants
export const DEFAULT_SLIPPAGE = 2;
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
export const ACCOUNTS_TO_VERIFY_ON_EXISTING_MNEMONIC_PHRASE = 6;
// Hard-expiry backstop: after this the session fully re-authenticates
// (HASH_KEY_EXPIRED). Must stay greater than the largest AUTO_LOCK_TIMER
// preset, or that preset's soft-lock fast path can never run (hard expiry
// fires first).
export const HASH_KEY_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const VISUAL_DELAY_MS = 500;

const SECOND_IN_MS = 1000;
const MINUTE_IN_MS = 60 * SECOND_IN_MS;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const YEAR_IN_MS = 365 * 24 * HOUR_IN_MS;

/**
 * Auto-lock timer options.
 *
 * The timer starts counting when the app goes to the background; returning to
 * the app after the selected duration soft-locks the wallet (AUTH_STATUS.LOCKED,
 * fast unlock path). Declaration order is the display order on the
 * Auto-Lock Timer settings screen.
 */
export enum AUTO_LOCK_TIMER {
  IMMEDIATELY = "immediately",
  ONE_MINUTE = "oneMinute",
  FIFTEEN_MINUTES = "fifteenMinutes",
  THIRTY_MINUTES = "thirtyMinutes",
  ONE_HOUR = "oneHour",
  TWELVE_HOURS = "twelveHours",
  TWENTY_FOUR_HOURS = "twentyFourHours",
  NONE = "none",
}

// 12h matches the extension's default (DEFAULT_AUTO_LOCK_TIMEOUT_MINUTES=720)
// so both platforms ship the same cadence.
export const DEFAULT_AUTO_LOCK_TIMER = AUTO_LOCK_TIMER.TWELVE_HOURS;

/** Toast ID used by the lock screen / overlay to surface unlock errors. */
export const UNLOCK_ERROR_TOAST_ID = "unlock-wallet-error";

/**
 * Toast IDs allowed to surface while the wallet is soft-locked — the lock
 * overlay's own messaging. Every other toast is suppressed so the still-
 * mounted screens underneath the overlay can't surface errors or validation
 * messages over the lock until the app is usable again.
 */
export const SOFT_LOCK_ALLOWED_TOAST_IDS: string[] = [UNLOCK_ERROR_TOAST_ID];

/**
 * Background duration (in ms) after which each AUTO_LOCK_TIMER option locks
 * the wallet. `0` locks as soon as the app is backgrounded; `null` never
 * auto-locks by timer.
 */
export const AUTO_LOCK_TIMER_MS: Record<AUTO_LOCK_TIMER, number | null> = {
  [AUTO_LOCK_TIMER.IMMEDIATELY]: 0,
  [AUTO_LOCK_TIMER.ONE_MINUTE]: MINUTE_IN_MS,
  [AUTO_LOCK_TIMER.FIFTEEN_MINUTES]: 15 * MINUTE_IN_MS,
  [AUTO_LOCK_TIMER.THIRTY_MINUTES]: 30 * MINUTE_IN_MS,
  [AUTO_LOCK_TIMER.ONE_HOUR]: HOUR_IN_MS,
  [AUTO_LOCK_TIMER.TWELVE_HOURS]: 12 * HOUR_IN_MS,
  [AUTO_LOCK_TIMER.TWENTY_FOUR_HOURS]: 24 * HOUR_IN_MS,
  [AUTO_LOCK_TIMER.NONE]: null,
};

/**
 * Hash key TTL used when the auto-lock timer is NONE: the user explicitly
 * opted out of auto-lock, so the 24h hard-expiry backstop must never force
 * a re-auth. Effectively "never" while remaining a valid timestamp.
 */
export const NEVER_EXPIRE_HASH_KEY_MS = 100 * YEAR_IN_MS;

// Recovery phrase validation constants
export const VALIDATION_WORDS_PER_ROW: number = 3;
export const VALIDATION_EXTRA_USER_WORDS: number = 2;
export const VALIDATION_DECOY_WORDS: number = 6;

export const DEFAULT_DECIMALS = 7;
export const FIAT_DECIMALS = 2;

/**
 * Absolute maximum amount for a classic Stellar token: 2^63 - 1 scaled by
 * 10^7 (the protocol's fixed 7-decimal precision). Soroban / custom tokens
 * have no protocol-level max here and rely on their own `decimals` field.
 */
export const CLASSIC_TOKEN_MAX_AMOUNT = "922337203685.4775807";

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
export const FREIGHTER_TERMS_URL = "https://www.freighter.app/terms";
export const FREIGHTER_PRIVACY_URL = "https://www.freighter.app/privacy";

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
 * The COLLECTIBLES_LIST is not removed during the standard logout process. It is used to keep the collectibles even after the user logs out, since the API does not store collectibles.
 *
 * HIDDEN_COLLECTIBLES_LIST The hidden collectibles list is used to keep track of all the hidden collectibles stored in the key manager.
 * Formatted as: { [publicKey: string]: { [network: string]: CollectibleContract[] } } @see CollectiblesStorage
 * The HIDDEN_COLLECTIBLES_LIST is not removed during the standard logout process. It is used to keep the hidden collectibles even after the user logs out, since the API does not store hidden collectibles.
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
  HIDDEN_COLLECTIBLES_LIST = "hiddenCollectiblesList",
  ACTIVE_NETWORK = "activeNetwork",
  RECENT_ADDRESSES = "recentAddresses",
  MEMO_REQUIRED_ACCOUNTS = "memoRequiredAccounts",
  VERIFIED_TOKENS_PREFIX = "verifiedTokens_",
  STELLAR_EXPERT_TOP_TOKENS_PREFIX = "stellarExpertTopTokens_",
  BLOCKAID_TOKEN_SCANS_PREFIX = "blockaidTokenScans_",
  WELCOME_BANNER_SHOWN_PREFIX = "welcomeBanner_shown_",
  HAS_SEEN_BIOMETRICS_ENABLE_SCREEN = "hasSeenBiometricsEnableScreen",
  HAS_SEEN_DISCOVER_WELCOME = "hasSeenDiscoverWelcome",
  APP_UPDATE_DISMISSED_REQUIRED_VERSION = "appUpdateDismissedRequiredVersion",
}

/**
 * Sensitive storage keys.
 *
 * TEMPORARY_STORE The temporary store contains encrypted private keys and mnemonic phrase.
 * HASH_KEY The hash key and salt in an JSON stryngified object. This is used to encrypt and decrypt the temporary store.
 * HASH_KEY format: { hashKey: string, salt: string, expiresAt: number }
 * AUTH_STATUS The authentication status is stored securely to prevent tampering on rooted/jailbroken devices.
 * AUTO_LOCK_TIMER_SETTING / AUTO_LOCK_BACKGROUNDED_AT The auto-lock policy inputs are stored
 * securely for the same reason: tampering them from unencrypted storage must not weaken the lock.
 * */
export enum SENSITIVE_STORAGE_KEYS {
  TEMPORARY_STORE = "temporaryStore",
  HASH_KEY = "hashKey",
  AUTH_STATUS = "authStatus",
  // Persisted symmetric encryption key (scrypt output). Derivable from HASH_KEY, so no extra
  // attack surface. Stored so cold app-opens from LOCKED skip the second scrypt.
  DERIVED_KEY = "derivedKey",
  AUTO_LOCK_TIMER_SETTING = "autoLockTimer",
  AUTO_LOCK_BACKGROUNDED_AT = "autoLockBackgroundedAt",
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
  MAX_SCREENSHOTS_STORED: 30,
  MAX_ACTIVE_WEBVIEWS: 10, // Maximum number of active WebView instances
  SCREENSHOT_FORMAT: "jpg",
  SCREENSHOT_QUALITY: 0.5,
  SCREENSHOT_WIDTH: 400,
  SCREENSHOT_HEIGHT: 600,
  SCREENSHOT_ON_LOAD_DELAY: 500, // Take screenshot after site finishes loading
  SCREENSHOT_SCROLL_DELAY: 1000, // Take screenshot after 1s of no-scrolling
  SCREENSHOT_FINAL_DELAY: 2000, // Take screenshot after site animations complete
  SCREENSHOT_DEK_SERVICE: "screenshot_dek", // Keychain service name for the screenshot DEK
  SCREENSHOT_FILES_DIR: "tab-screenshots", // Subdirectory under CachesDirectoryPath
  OPEN_ANIMATION_DURATION: 200,
  CLOSE_ANIMATION_DURATION: 200,
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
  /** For scanning from the home screen (handles both addresses and WalletConnect) */
  HOME_SCANNER = "home_scanner",
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
