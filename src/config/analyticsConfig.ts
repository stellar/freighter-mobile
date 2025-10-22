import { ALL_ROUTES_OBJECT } from "config/routes";

/**
 * Analytics Event Definitions
 *
 * These events define all analytics tracking points in the Freighter mobile app.
 * Events are organized by category for better maintainability.
 */
export enum AnalyticsEvent {
  // Screen Navigation Events (Auto-generated from routes)
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
  VIEW_SIGN_DAPP_TRANSACTION_DETAILS = "loaded screen: sign transaction details",
  VIEW_SEND_SEARCH_CONTACTS = "loaded screen: send payment to",
  VIEW_SEND_AMOUNT = "loaded screen: send payment amount",
  VIEW_SEND_MEMO = "loaded screen: send payment settings",
  VIEW_SEND_FEE = "loaded screen: send payment fee",
  VIEW_SEND_TIMEOUT = "loaded screen: send payment timeout",
  VIEW_SEND_CONFIRM = "loaded screen: send payment confirm",
  VIEW_SEND_TRANSACTION_DETAILS = "loaded screen: send transaction details",
  VIEW_SEND_PROCESSING = "loaded screen: send payment processing",
  VIEW_SWAP = "loaded screen: swap",
  VIEW_SWAP_AMOUNT = "loaded screen: swap amount",
  VIEW_SWAP_FEE = "loaded screen: swap fee",
  VIEW_SWAP_SLIPPAGE = "loaded screen: swap slippage",
  VIEW_SWAP_TIMEOUT = "loaded screen: swap timeout",
  VIEW_SWAP_SETTINGS = "loaded screen: swap settings",
  VIEW_SWAP_CONFIRM = "loaded screen: swap confirm",
  VIEW_SWAP_TRANSACTION_DETAILS = "loaded screen: swap transaction details",
  VIEW_SETTINGS = "loaded screen: settings",
  VIEW_PREFERENCES = "loaded screen: preferences",
  VIEW_CHANGE_NETWORK = "loaded screen: manage network",
  VIEW_NETWORK_SETTINGS = "loaded screen: network settings",
  VIEW_SHARE_FEEDBACK = "loaded screen: leave feedback",
  VIEW_ABOUT = "loaded screen: about",
  VIEW_SECURITY = "loaded screen: security",
  VIEW_SHOW_RECOVERY_PHRASE = "loaded screen: show recovery phrase",
  VIEW_MANAGE_CONNECTED_APPS = "loaded screen: manage connected apps",
  VIEW_MANAGE_TOKENS = "loaded screen: manage assets",
  VIEW_ADD_TOKEN = "loaded screen: add asset",
  VIEW_REMOVE_TOKEN = "loaded screen: remove asset",
  VIEW_MANAGE_WALLETS = "loaded screen: manage wallets",
  VIEW_IMPORT_SECRET_KEY = "loaded screen: import secret key",
  VIEW_BUY_XLM = "loaded screen: add fund",
  VIEW_SEARCH_TOKEN = "loaded screen: search asset",
  VIEW_ADD_TOKEN_MANUALLY = "loaded screen: add asset manually",

  // User Action Events (Manual tracking)
  CREATE_PASSWORD_SUCCESS = "account creator: create password: success",
  CREATE_PASSWORD_FAIL = "account creator: create password: error",
  VIEWED_RECOVERY_PHRASE = "account creator: viewed phrase",
  CONFIRM_RECOVERY_PHRASE_SUCCESS = "account creator: confirm phrase: confirmed phrase",
  CONFIRM_RECOVERY_PHRASE_FAIL = "account creator: confirm phrase: error confirming",
  ACCOUNT_CREATOR_CONFIRM_MNEMONIC_BACK = "account creator: confirm phrase: back to phrase",
  ACCOUNT_CREATOR_FINISHED = "account creator finished: closed account creator flow",

  // Authentication Events
  RE_AUTH_SUCCESS = "re-auth: success",
  RE_AUTH_FAIL = "re-auth: error",
  RECOVER_ACCOUNT_SUCCESS = "recover account: success",
  RECOVER_ACCOUNT_FAIL = "recover account: error",

  // Send Payment Events
  SEND_PAYMENT_SUCCESS = "send payment: payment success",
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

  // Token Management Events
  ADD_TOKEN_SUCCESS = "manage asset: add asset",
  ADD_UNSAFE_TOKEN_SUCCESS = "manage asset: add unsafe asset",
  REMOVE_TOKEN_SUCCESS = "manage asset: remove asset",
  TOKEN_MANAGEMENT_FAIL = "manage asset: error",
  ADD_TOKEN_CONFIRMED = "add token: confirmed",
  ADD_TOKEN_REJECTED = "add token: rejected",
  REMOVE_TOKEN_CONFIRMED = "remove token: confirmed",
  REMOVE_TOKEN_REJECTED = "remove token: rejected",
  MANAGE_TOKEN_LISTS_MODIFY = "manage asset list: modify asset list",

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

  // App Update Events
  APP_UPDATE_OPEN_STORE_FROM_BANNER = "app update: opened app store from banner",
  APP_UPDATE_OPEN_STORE_FROM_SCREEN = "app update: opened app store from screen",
  APP_UPDATE_CONFIRMED_SKIP_ON_SCREEN = "app update: confirmed skip on screen",

  // Blockaid Events
  BLOCKAID_BULK_TOKEN_SCAN = "blockaid: bulk scanned tokens",
  BLOCKAID_TOKEN_SCAN = "blockaid: scanned asset",
  BLOCKAID_SITE_SCAN = "blockaid: scanned domain",
  BLOCKAID_TRANSACTION_SCAN = "blockaid: scanned transaction",

  // Onramp Events
  COINBASE_ONRAMP_OPENED = "coinbase onramp: opened",
}

/**
 * Route-to-Analytics Mapping Configuration
 *
 * This configuration defines how routes are mapped to analytics events.
 * The system uses automatic transformation with manual overrides for special cases.
 */

/**
 * Automatically identifies routes that should NOT have analytics events.
 * Filters by "Stack" suffix to exclude navigator-level routes.
 */
const getRoutesWithoutAnalytics = (): Set<string> => {
  const excludedRoutes = new Set<string>();

  ALL_ROUTES_OBJECT.forEach((routeObject) => {
    Object.values(routeObject).forEach((routeName) => {
      // Exclude navigator-level routes (end with "Stack")
      if (typeof routeName === "string" && routeName.endsWith("Stack")) {
        excludedRoutes.add(routeName);
      }
    });
  });

  return excludedRoutes;
};

// Routes that should NOT have analytics events (automatically generated)
export const ROUTES_WITHOUT_ANALYTICS = getRoutesWithoutAnalytics();

/**
 * Manual overrides for routes that don't follow the auto-transformation pattern.
 *
 * These are special cases where the automatic transformation doesn't produce
 * the correct analytics event name. Keep this list minimal!
 */
export const CUSTOM_ROUTE_MAPPINGS: Record<string, AnalyticsEvent> = {
  // Auth flow overrides (extension uses different names)
  ChoosePasswordScreen: AnalyticsEvent.VIEW_CHOOSE_PASSWORD,
  RecoveryPhraseAlertScreen: AnalyticsEvent.VIEW_RECOVERY_PHRASE_ALERT,
  RecoveryPhraseScreen: AnalyticsEvent.VIEW_RECOVERY_PHRASE,
  ValidateRecoveryPhraseScreen: AnalyticsEvent.VIEW_VALIDATE_RECOVERY_PHRASE,
  ImportWalletScreen: AnalyticsEvent.VIEW_IMPORT_WALLET,
  LockScreen: AnalyticsEvent.VIEW_LOCK_SCREEN,

  // Main tab overrides (extension uses different names)
  Home: AnalyticsEvent.VIEW_HOME,
  History: AnalyticsEvent.VIEW_HISTORY,
  Discovery: AnalyticsEvent.VIEW_DISCOVERY,

  // Root navigator overrides
  AccountQRCodeScreen: AnalyticsEvent.VIEW_ACCOUNT_QR_CODE,
  TokenDetailsScreen: AnalyticsEvent.VIEW_TOKEN_DETAILS,

  // Send payment overrides (extension uses different names)
  SendSearchContactsScreen: AnalyticsEvent.VIEW_SEND_SEARCH_CONTACTS,
  TransactionAmountScreen: AnalyticsEvent.VIEW_SEND_AMOUNT,
  TransactionMemoScreen: AnalyticsEvent.VIEW_SEND_MEMO,
  TransactionFeeScreen: AnalyticsEvent.VIEW_SEND_FEE,
  TransactionTimeoutScreen: AnalyticsEvent.VIEW_SEND_TIMEOUT,

  // Settings overrides
  ChangeNetworkScreen: AnalyticsEvent.VIEW_CHANGE_NETWORK,
  ShareFeedbackScreen: AnalyticsEvent.VIEW_SHARE_FEEDBACK,
  ShowRecoveryPhraseScreen: AnalyticsEvent.VIEW_SHOW_RECOVERY_PHRASE,

  // Buy XLM override
  BuyXLMScreen: AnalyticsEvent.VIEW_BUY_XLM,
};

/**
 * Transform route name to analytics event name automatically.
 *
 * This function implements the core transformation logic that converts
 * React Navigation route names to analytics event names.
 *
 * Examples:
 * - "WelcomeScreen" → "loaded screen: welcome"
 * - "SettingsScreen" → "loaded screen: settings"
 * - "SwapAmountScreen" → "loaded screen: swap amount"
 */
export const transformRouteToEventName = (routeName: string): string => {
  // Remove "Screen" suffix if present
  const baseName = routeName.replace(/Screen$/, "");

  // Convert PascalCase to lowercase with spaces
  // "SwapAmount" → "swap amount"
  const withSpaces = baseName
    .replace(/([A-Z])/g, " $1") // Add space before capitals
    .toLowerCase()
    .trim();

  return `loaded screen: ${withSpaces}`;
};

/**
 * Processes a single route for analytics mapping.
 * Uses automatic transformation unless there's a manual override.
 */
export const processRouteForAnalytics = (
  routeName: string,
): AnalyticsEvent | null => {
  // Check exclusion list first
  if (ROUTES_WITHOUT_ANALYTICS.has(routeName)) {
    return null;
  }

  // Check manual overrides first
  if (CUSTOM_ROUTE_MAPPINGS[routeName]) {
    return CUSTOM_ROUTE_MAPPINGS[routeName];
  }

  // Use automatic transformation for all other routes
  const autoEvent = transformRouteToEventName(routeName);

  return autoEvent as AnalyticsEvent;
};

/**
 * Generates the complete route-to-analytics mapping using ALL_ROUTE_OBJECTS.
 *
 * This function automatically discovers all routes and creates analytics mappings
 * without requiring manual maintenance of route lists.
 */
export const generateRouteToAnalyticsMapping = () => {
  const mapping: Record<string, AnalyticsEvent | null> = {};

  ALL_ROUTES_OBJECT.forEach((routeObject) => {
    Object.values(routeObject).forEach((routeName) => {
      if (typeof routeName === "string") {
        const analyticsEvent = processRouteForAnalytics(routeName);
        mapping[routeName] = analyticsEvent;
      }
    });
  });

  return mapping;
};

/**
 * Pre-generated mapping of routes to analytics events.
 *
 * This mapping is generated once at module load time and provides
 * O(1) lookup performance for route-to-analytics conversion.
 */
export const ROUTE_TO_ANALYTICS_EVENT_MAP = generateRouteToAnalyticsMapping();

/**
 * Type-safe route discovery for compile-time checking.
 *
 * This type ensures that all route objects are properly typed
 * and can be used for analytics mapping.
 */
export type RouteObject = (typeof ALL_ROUTES_OBJECT)[number];
