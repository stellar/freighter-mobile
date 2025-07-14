/**
 * Analytics events enum for tracking user behavior across the Freighter mobile app.
 *
 * Events are aligned with Freighter extension to ensure consistent cross-platform
 */
export enum AnalyticsEvent {
  // Screen Navigation Events
  VIEW_WELCOME = "loaded screen: welcome",
  VIEW_CHOOSE_PASSWORD = "loaded screen: account creator",
  VIEW_RECOVERY_PHRASE_ALERT = "loaded screen: mnemonic phrase alert",
  VIEW_RECOVERY_PHRASE = "loaded screen: mnemonic phrase",
  VIEW_VALIDATE_RECOVERY_PHRASE = "loaded screen: confirm mnemonic phrase",
  VIEW_IMPORT_WALLET = "loaded screen: recover account",
  VIEW_LOCK_SCREEN = "loaded screen: unlock account",
  VIEW_HOME = "loaded screen: account",
  VIEW_HISTORY = "loaded screen: account history",
  VIEW_DISCOVERY = "loaded screen: discover",
  VIEW_TOKEN_DETAILS = "loaded screen: asset detail",
  VIEW_ACCOUNT_QR_CODE = "loaded screen: view public key generator",
  VIEW_GRANT_DAPP_ACCESS = "loaded screen: grant access",
  VIEW_SIGN_DAPP_TRANSACTION = "loaded screen: sign transaction",
  VIEW_SEND_SEARCH_CONTACTS = "loaded screen: send payment to",
  VIEW_SEND_AMOUNT = "loaded screen: send payment amount",
  VIEW_SEND_MEMO = "loaded screen: send payment settings",
  VIEW_SEND_FEE = "loaded screen: send payment fee",
  VIEW_SEND_TIMEOUT = "loaded screen: send payment timeout",
  VIEW_SEND_CONFIRM = "loaded screen: send payment confirm",
  VIEW_SEND_PROCESSING = "loaded screen: send payment processing",
  VIEW_SWAP = "loaded screen: swap",
  VIEW_SWAP_AMOUNT = "loaded screen: swap amount",
  VIEW_SWAP_FEE = "loaded screen: swap fee",
  VIEW_SWAP_SLIPPAGE = "loaded screen: swap slippage",
  VIEW_SWAP_TIMEOUT = "loaded screen: swap timeout",
  VIEW_SWAP_SETTINGS = "loaded screen: swap settings",
  VIEW_SWAP_CONFIRM = "loaded screen: swap confirm",
  VIEW_SETTINGS = "loaded screen: settings",
  VIEW_PREFERENCES = "loaded screen: preferences",
  VIEW_CHANGE_NETWORK = "loaded screen: manage network",
  VIEW_NETWORK_SETTINGS = "loaded screen: network settings",
  VIEW_SHARE_FEEDBACK = "loaded screen: leave feedback",
  VIEW_ABOUT = "loaded screen: about",
  VIEW_SECURITY = "loaded screen: security",
  VIEW_SHOW_RECOVERY_PHRASE = "loaded screen: show recovery phrase",
  VIEW_MANAGE_CONNECTED_APPS = "loaded screen: manage connected apps",
  VIEW_MANAGE_ASSETS = "loaded screen: manage assets",
  VIEW_ADD_ASSET = "loaded screen: add asset",
  VIEW_MANAGE_WALLETS = "loaded screen: manage wallets",
  VIEW_IMPORT_SECRET_KEY = "loaded screen: import secret key",
  VIEW_BUY_XLM = "loaded screen: add fund",
  VIEW_SEARCH_ASSET = "loaded screen: search asset",
  VIEW_ADD_ASSET_MANUALLY = "loaded screen: add asset manually",

  // User Action Events
  CREATE_PASSWORD_SUCCESS = "account creator: create password: success",
  CREATE_PASSWORD_FAIL = "account creator: create password: error",
  VIEWED_RECOVERY_PHRASE = "account creator: viewed phrase",
  CONFIRM_RECOVERY_PHRASE_SUCCESS = "account creator: confirm phrase: confirmed phrase",
  CONFIRM_RECOVERY_PHRASE_FAIL = "account creator: confirm phrase: error confirming",

  // Authentication Events
  RE_AUTH_SUCCESS = "re-auth: success", // Used for both confirm password and unlock
  RE_AUTH_FAIL = "re-auth: error", // Used for both confirm password and unlock
  RECOVER_ACCOUNT_SUCCESS = "recover account: success",
  RECOVER_ACCOUNT_FAIL = "recover account: error",

  // Send Payment Events
  SEND_PAYMENT_SUCCESS = "send payment: payment success",
  SEND_PAYMENT_PATH_PAYMENT_SUCCESS = "send payment: path payment success",
  SEND_PAYMENT_FAIL = "send payment: error",
  SEND_PAYMENT_SET_MAX = "send payment: set max",
  SEND_PAYMENT_TYPE_PAYMENT = "send payment: selected type payment",
  SEND_PAYMENT_TYPE_PATH_PAYMENT = "send payment: selected type path payment",
  SEND_PAYMENT_RECENT_ADDRESS = "send payment: recent address",
  SWAP_SUCCESS = "swap: success",
  SWAP_FAIL = "swap: error",

  // Copy Events
  COPY_PUBLIC_KEY = "viewPublicKey: copied public key",
  COPY_BACKUP_PHRASE = "backup phrase: copied phrase",
  DOWNLOAD_BACKUP_PHRASE = "backup phrase: downloaded phrase",

  // Transaction & Simulation Events
  SIMULATE_TOKEN_PAYMENT_ERROR = "failed to simulate token payment",
  SIGN_TRANSACTION_SUCCESS = "sign transaction: confirmed",
  SIGN_TRANSACTION_FAIL = "sign transaction: rejected",
  SIGN_TRANSACTION_MEMO_REQUIRED_FAIL = "sign transaction: memo required error",

  // Asset Management Events
  ADD_ASSET_SUCCESS = "manage asset: add asset",
  ADD_TOKEN_SUCCESS = "manage asset: add token",
  ADD_UNSAFE_ASSET_SUCCESS = "manage asset: add unsafe asset",
  REMOVE_ASSET_SUCCESS = "manage asset: remove asset",
  ASSET_MANAGEMENT_FAIL = "manage asset: error",
  ADD_TOKEN_CONFIRMED = "add token: confirmed",
  ADD_TOKEN_REJECTED = "add token: rejected",
  MANAGE_ASSET_LISTS_MODIFY = "manage asset list: modify asset list",

  // Trustline Error Events
  TRUSTLINE_INSUFFICIENT_BALANCE_FAIL = "trustline removal error: asset has balance",
  TRUSTLINE_HAS_LIABILITIES_FAIL = "trustline removal error: asset has buying liabilties",
  TRUSTLINE_LOW_RESERVE_FAIL = "trustline removal error: asset has low reserve",

  // Account Management Events
  ACCOUNT_SCREEN_ADD_ACCOUNT = "account screen: created new account",
  ACCOUNT_SCREEN_COPY_PUBLIC_KEY = "account screen: copied public key",
  ACCOUNT_SCREEN_IMPORT_ACCOUNT = "account screen: imported new account",
  ACCOUNT_SCREEN_IMPORT_ACCOUNT_FAIL = "account screen: imported new account: error",
  VIEW_PUBLIC_KEY_ACCOUNT_RENAMED = "viewPublicKey: renamed account",
  VIEW_PUBLIC_KEY_CLICKED_STELLAR_EXPERT = "viewPublicKey: clicked StellarExpert",

  // WalletConnect/dApp Events
  GRANT_DAPP_ACCESS_SUCCESS = "grant access: granted",
  GRANT_DAPP_ACCESS_FAIL = "grant access: rejected",

  // History Events
  HISTORY_OPEN_FULL_HISTORY = "history: opened full history on external website",
  HISTORY_OPEN_ITEM = "history: opened item on external website",

  APP_OPENED = "event: App Opened",

  // Mobile-Only Events
  QR_SCAN_SUCCESS = "mobile: qr scan success",
  QR_SCAN_ERROR = "mobile: qr scan error",
}
