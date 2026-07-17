import { ALL_ROUTES_OBJECT } from "config/routes";

/**
 * Analytics Event Definitions
 *
 * These events define all analytics tracking points in the Freighter mobile app.
 * Events are organized by category for better maintainability.
 */
export enum AnalyticsEvent {
  // Canonical screen-view event (#2883).
  //
  // Every screen load emits THIS single event carrying { screen_name, flow,
  // surface, step? }. The VIEW_* members below hold each screen's canonical
  // `screen_name` directly as their value; they are the identifiers that
  // components firing screen views manually (bottom sheets / detail sheets)
  // reference, and are NEVER emitted as event names themselves — they only
  // populate the `screen_name` prop on `screen.viewed`.
  SCREEN_VIEWED = "screen.viewed",

  // Screen Navigation Events (Auto-generated from routes)
  VIEW_WELCOME = "welcome",
  VIEW_CHOOSE_PASSWORD = "account_creator",
  VIEW_RECOVERY_PHRASE_ALERT = "mnemonic_phrase_alert",
  VIEW_RECOVERY_PHRASE = "mnemonic_phrase",
  VIEW_VALIDATE_RECOVERY_PHRASE = "confirm_mnemonic_phrase",
  VIEW_IMPORT_WALLET = "recover_account",
  VIEW_LOCK_SCREEN = "unlock_account",
  VIEW_HOME = "account",
  VIEW_HISTORY = "account_history",
  VIEW_DISCOVERY = "discover",
  VIEW_TOKEN_DETAILS = "asset_detail",
  VIEW_ACCOUNT_QR_CODE = "view_public_key_generator",
  VIEW_GRANT_DAPP_ACCESS = "grant_access",
  VIEW_SIGN_DAPP_TRANSACTION = "sign_transaction",
  VIEW_SIGN_DAPP_TRANSACTION_DETAILS = "sign_transaction_details",
  VIEW_SIGN_DAPP_AUTH_ENTRY_DETAILS = "sign_auth_entry_details",
  VIEW_SEND_SEARCH_CONTACTS = "send_payment_to",
  VIEW_SEND_AMOUNT = "send_payment_amount",
  VIEW_SEND_MEMO = "send_payment_settings",
  VIEW_SEND_FEE = "send_payment_fee",
  VIEW_SEND_TIMEOUT = "send_payment_timeout",
  VIEW_SEND_CONFIRM = "send_payment_confirm",
  VIEW_SEND_TRANSACTION_DETAILS = "send_transaction_details",
  VIEW_SEND_PROCESSING = "send_payment_processing",
  VIEW_SWAP = "swap",
  VIEW_SWAP_AMOUNT = "swap_amount",
  VIEW_SWAP_FEE = "swap_fee",
  VIEW_SWAP_SLIPPAGE = "swap_slippage",
  VIEW_SWAP_TIMEOUT = "swap_timeout",
  VIEW_SWAP_SETTINGS = "swap_settings",
  VIEW_SWAP_CONFIRM = "swap_confirm",
  VIEW_SWAP_TRANSACTION_DETAILS = "swap_transaction_details",
  VIEW_SETTINGS = "settings",
  VIEW_PREFERENCES = "preferences",
  VIEW_CHANGE_NETWORK = "manage_network",
  VIEW_NETWORK_SETTINGS = "network_settings",
  VIEW_SHARE_FEEDBACK = "leave_feedback",
  VIEW_ABOUT = "about",
  VIEW_SECURITY = "security",
  VIEW_SHOW_RECOVERY_PHRASE = "show_recovery_phrase",
  VIEW_MANAGE_CONNECTED_APPS = "manage_connected_apps",
  VIEW_MANAGE_TOKENS = "manage_assets",
  VIEW_ADD_TOKEN = "add_asset",
  VIEW_REMOVE_TOKEN = "remove_asset",
  VIEW_MANAGE_WALLETS = "manage_wallets",
  VIEW_IMPORT_SECRET_KEY = "import_secret_key",
  VIEW_BUY_XLM = "add_fund",
  VIEW_SEARCH_TOKEN = "search_asset",
  VIEW_ADD_TOKEN_MANUALLY = "add_asset_manually",

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
  SWAP_TO_PICKER_OPENED = "swap: to-picker opened",
  SWAP_FROM_PICKER_OPENED = "swap: from-picker opened",
  SWAP_DIRECTION_TOGGLED = "swap: direction toggled",
  SWAP_TRENDING_TOKEN_TAPPED = "swap: trending token tapped",
  SWAP_TRENDING_SWAP_TO_PRESSED = "swap: trending swap-to pressed",
  SWAP_DESTINATION_SELECTED = "swap: destination selected",
  SWAP_SOURCE_SELECTED = "swap: source selected",
  SWAP_TRUSTLINE_ADDED = "swap: trustline added",
  SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN = "swap: xlm reserve insufficient shown",
  SWAP_QUOTE_EXPIRED = "swap: quote expired",

  // Send Collectible Events
  SEND_COLLECTIBLE_SUCCESS = "send collectible: success",
  SEND_COLLECTIBLE_FAIL = "send collectible: error",

  // Copy Events
  COPY_PUBLIC_KEY = "viewPublicKey: copied public key",
  COPY_BACKUP_PHRASE = "backup phrase: copied phrase",
  DOWNLOAD_BACKUP_PHRASE = "backup phrase: downloaded phrase",

  // Transaction & Simulation Events
  SIMULATE_TOKEN_PAYMENT_ERROR = "failed to simulate token payment",
  SIGN_TRANSACTION_SUCCESS = "sign transaction: confirmed",
  SIGN_TRANSACTION_FAIL = "sign transaction: rejected",
  SIGN_TRANSACTION_MEMO_REQUIRED_FAIL = "sign transaction: memo required error",
  SUBMIT_TRANSACTION_SUCCESS = "submit transaction: confirmed",
  SIGN_MESSAGE_SUCCESS = "sign message: confirmed",
  SIGN_MESSAGE_FAIL = "sign message: error",
  SIGN_AUTH_ENTRY_SUCCESS = "sign auth entry: confirmed",
  SIGN_AUTH_ENTRY_FAIL = "sign auth entry: error",

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

  // Jailbreak Events
  DEVICE_JAILBREAK_DETECTED = "device security: jailbreak detected",
  DEVICE_JAILBREAK_FAILED = "device security: jailbreak detection failed",

  // Discover Events
  DISCOVER_PROTOCOL_OPENED = "discover: protocol opened",
  DISCOVER_PROTOCOL_DETAILS_VIEWED = "discover: protocol details viewed",
  DISCOVER_PROTOCOL_OPENED_FROM_DETAILS = "discover: protocol opened from details",
  DISCOVER_TAB_CREATED = "discover: tab created",
  DISCOVER_TAB_CLOSED = "discover: tab closed",
  DISCOVER_ALL_TABS_CLOSED = "discover: all tabs closed",
  DISCOVER_WELCOME_MODAL_VIEWED = "discover: welcome modal viewed",
}

/**
 * Tags how the user reached the Swap source / destination picker, for the
 * SWAP_FROM_PICKER_OPENED + SWAP_TO_PICKER_OPENED analytics events.
 *
 * - CTA: the missing-side prompt button (e.g. "Select a token" / "Sell")
 *   on SwapAmountScreen fired the navigation.
 * - DROPDOWN: the picker chip itself was tapped.
 *
 * Wire values match the historical inline string union so existing Amplitude
 * dashboards / funnels keyed on `source: "cta"` / `source: "dropdown"` keep
 * working unchanged.
 */
export enum SwapPickerEntrypoint {
  CTA = "cta",
  DROPDOWN = "dropdown",
}

/**
 * Tags which list bucket the user picked a swap token from. Wire values are
 * an Amplitude dashboard contract -- do not rename without coordinating with
 * analytics.
 */
export enum SwapSelectionSource {
  BALANCES = "balances",
  POPULAR = "popular",
  SEARCH = "search",
  TRENDING = "trending",
}

/**
 * Cross-platform "flow" dimension for the canonical `screen.viewed` event.
 *
 * Each screen is assigned its best-fit flow so screen views can be funneled by
 * user journey in shared analytics dashboards. Values are the RFC's low-
 * cardinality flow vocabulary; a screen may omit `flow` when none fits.
 */
export enum AnalyticsFlow {
  ONBOARDING = "onboarding",
  SEND = "send",
  SWAP = "swap",
  SIGNING = "signing",
  ASSETS = "assets",
  SETTINGS = "settings",
  DISCOVERY = "discovery",
  SECURITY = "security",
  HISTORY = "history",
}

/**
 * Property bag carried by the single canonical `screen.viewed` event.
 *
 * - `screen_name`: canonical, cross-platform id — a named screen's VIEW_*
 *   enum value; auto-mapped routes derive it from the route name.
 * - `flow`: best-fit user journey (see AnalyticsFlow); omitted when none fits.
 * - `step`: sub-step marker for screens that are a stage within a flow
 *   (e.g. a confirmation or processing screen) rather than a distinct
 *   destination. Collapses completion/success screens into `screen.viewed`
 *   instead of a bespoke event.
 *
 * `surface` is intentionally NOT included here: it is added to every event by
 * the Slice-A common context (buildCommonContext -> getSurface()).
 */
// A `type` alias (not an `interface`) so it stays assignable to the
// `Record<string, unknown>`-based `AnalyticsProps` at the track() call sites -
// interfaces are not assignable to an index signature, type aliases are.
export type ScreenViewedProps = {
  screen_name: string;
  flow?: AnalyticsFlow;
  step?: string;
};

/**
 * Per-screen `flow`/`step` for named screens, keyed by the screen's canonical
 * `screen_name` (its VIEW_* enum value). The `screen_name` itself is the key,
 * so it isn't repeated inside. Routes NOT listed here (auto-mapped via
 * routeToScreenName) still emit `screen.viewed` with their route-derived
 * `screen_name` but carry no `flow` — see buildScreenViewedProps.
 */
const SCREEN_CATALOG: Record<string, { flow?: AnalyticsFlow; step?: string }> =
  {
    // Onboarding / account creation
    [AnalyticsEvent.VIEW_WELCOME]: {
      flow: AnalyticsFlow.ONBOARDING,
    },
    [AnalyticsEvent.VIEW_CHOOSE_PASSWORD]: {
      flow: AnalyticsFlow.ONBOARDING,
    },
    [AnalyticsEvent.VIEW_RECOVERY_PHRASE_ALERT]: {
      flow: AnalyticsFlow.ONBOARDING,
    },
    [AnalyticsEvent.VIEW_RECOVERY_PHRASE]: {
      flow: AnalyticsFlow.ONBOARDING,
    },
    [AnalyticsEvent.VIEW_VALIDATE_RECOVERY_PHRASE]: {
      flow: AnalyticsFlow.ONBOARDING,
    },
    [AnalyticsEvent.VIEW_IMPORT_WALLET]: {
      flow: AnalyticsFlow.ONBOARDING,
    },
    // Security / re-auth / secret material
    [AnalyticsEvent.VIEW_LOCK_SCREEN]: {
      flow: AnalyticsFlow.SECURITY,
    },
    [AnalyticsEvent.VIEW_SECURITY]: {
      flow: AnalyticsFlow.SECURITY,
    },
    [AnalyticsEvent.VIEW_SHOW_RECOVERY_PHRASE]: {
      flow: AnalyticsFlow.SECURITY,
    },
    [AnalyticsEvent.VIEW_IMPORT_SECRET_KEY]: {
      flow: AnalyticsFlow.SECURITY,
    },
    // Home / assets
    [AnalyticsEvent.VIEW_HOME]: {
      flow: AnalyticsFlow.ASSETS,
    },
    [AnalyticsEvent.VIEW_TOKEN_DETAILS]: {
      flow: AnalyticsFlow.ASSETS,
    },
    [AnalyticsEvent.VIEW_ACCOUNT_QR_CODE]: {
      flow: AnalyticsFlow.ASSETS,
    },
    [AnalyticsEvent.VIEW_MANAGE_TOKENS]: {
      flow: AnalyticsFlow.ASSETS,
    },
    [AnalyticsEvent.VIEW_ADD_TOKEN]: {
      flow: AnalyticsFlow.ASSETS,
    },
    [AnalyticsEvent.VIEW_REMOVE_TOKEN]: {
      flow: AnalyticsFlow.ASSETS,
    },
    [AnalyticsEvent.VIEW_SEARCH_TOKEN]: {
      flow: AnalyticsFlow.ASSETS,
    },
    [AnalyticsEvent.VIEW_ADD_TOKEN_MANUALLY]: {
      flow: AnalyticsFlow.ASSETS,
    },
    [AnalyticsEvent.VIEW_BUY_XLM]: {
      flow: AnalyticsFlow.ASSETS,
    },
    // History
    [AnalyticsEvent.VIEW_HISTORY]: {
      flow: AnalyticsFlow.HISTORY,
    },
    // Discovery
    [AnalyticsEvent.VIEW_DISCOVERY]: {
      flow: AnalyticsFlow.DISCOVERY,
    },
    // Signing / dApp
    [AnalyticsEvent.VIEW_GRANT_DAPP_ACCESS]: {
      flow: AnalyticsFlow.SIGNING,
    },
    [AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION]: {
      flow: AnalyticsFlow.SIGNING,
    },
    [AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION_DETAILS]: {
      flow: AnalyticsFlow.SIGNING,
    },
    [AnalyticsEvent.VIEW_SIGN_DAPP_AUTH_ENTRY_DETAILS]: {
      flow: AnalyticsFlow.SIGNING,
    },
    // Send payment
    [AnalyticsEvent.VIEW_SEND_SEARCH_CONTACTS]: {
      flow: AnalyticsFlow.SEND,
    },
    [AnalyticsEvent.VIEW_SEND_AMOUNT]: {
      flow: AnalyticsFlow.SEND,
    },
    [AnalyticsEvent.VIEW_SEND_MEMO]: {
      flow: AnalyticsFlow.SEND,
    },
    [AnalyticsEvent.VIEW_SEND_FEE]: {
      flow: AnalyticsFlow.SEND,
    },
    [AnalyticsEvent.VIEW_SEND_TIMEOUT]: {
      flow: AnalyticsFlow.SEND,
    },
    [AnalyticsEvent.VIEW_SEND_CONFIRM]: {
      flow: AnalyticsFlow.SEND,
      step: "confirm",
    },
    [AnalyticsEvent.VIEW_SEND_TRANSACTION_DETAILS]: {
      flow: AnalyticsFlow.SEND,
    },
    [AnalyticsEvent.VIEW_SEND_PROCESSING]: {
      flow: AnalyticsFlow.SEND,
      step: "processing",
    },
    // Swap
    [AnalyticsEvent.VIEW_SWAP]: { flow: AnalyticsFlow.SWAP },
    [AnalyticsEvent.VIEW_SWAP_AMOUNT]: {
      flow: AnalyticsFlow.SWAP,
    },
    [AnalyticsEvent.VIEW_SWAP_FEE]: {
      flow: AnalyticsFlow.SWAP,
    },
    [AnalyticsEvent.VIEW_SWAP_SLIPPAGE]: {
      flow: AnalyticsFlow.SWAP,
    },
    [AnalyticsEvent.VIEW_SWAP_TIMEOUT]: {
      flow: AnalyticsFlow.SWAP,
    },
    [AnalyticsEvent.VIEW_SWAP_SETTINGS]: {
      flow: AnalyticsFlow.SWAP,
    },
    [AnalyticsEvent.VIEW_SWAP_CONFIRM]: {
      flow: AnalyticsFlow.SWAP,
      step: "confirm",
    },
    [AnalyticsEvent.VIEW_SWAP_TRANSACTION_DETAILS]: {
      flow: AnalyticsFlow.SWAP,
    },
    // Settings
    [AnalyticsEvent.VIEW_SETTINGS]: {
      flow: AnalyticsFlow.SETTINGS,
    },
    [AnalyticsEvent.VIEW_PREFERENCES]: {
      flow: AnalyticsFlow.SETTINGS,
    },
    [AnalyticsEvent.VIEW_CHANGE_NETWORK]: {
      flow: AnalyticsFlow.SETTINGS,
    },
    [AnalyticsEvent.VIEW_NETWORK_SETTINGS]: {
      flow: AnalyticsFlow.SETTINGS,
    },
    [AnalyticsEvent.VIEW_SHARE_FEEDBACK]: {
      flow: AnalyticsFlow.SETTINGS,
    },
    [AnalyticsEvent.VIEW_ABOUT]: {
      flow: AnalyticsFlow.SETTINGS,
    },
    [AnalyticsEvent.VIEW_MANAGE_CONNECTED_APPS]: {
      flow: AnalyticsFlow.SETTINGS,
    },
    [AnalyticsEvent.VIEW_MANAGE_WALLETS]: {
      flow: AnalyticsFlow.SETTINGS,
    },
  };

/**
 * True when `event` is a known screen-view — i.e. a canonical `screen_name`
 * present in SCREEN_CATALOG. Such events are retargeted to the single
 * `screen.viewed` event; everything else (action/domain events) is tracked
 * unchanged.
 */
export const isScreenViewEvent = (event: string): boolean =>
  event in SCREEN_CATALOG;

/**
 * Builds the `screen.viewed` property bag for a screen: the `screen_name`
 * itself (a named screen passes its VIEW_* enum value; an auto-mapped route
 * passes its route-derived name) plus the catalogued `flow`/`step` (omitted
 * when the screen is not catalogued or carries none).
 */
export const buildScreenViewedProps = (
  screenName: string,
): ScreenViewedProps => {
  const meta = SCREEN_CATALOG[screenName];
  const props: ScreenViewedProps = { screen_name: screenName };
  if (meta?.flow) props.flow = meta.flow;
  if (meta?.step) props.step = meta.step;
  return props;
};

/**
 * Retargeting helper for manual screen-view emission sites (e.g. bottom
 * sheets that present a "screen"). Returns the `screen.viewed` props for a
 * catalogued screen-view event, or null for any non-screen event (which
 * should be tracked unchanged).
 */
export const getScreenViewedProps = (
  event: string,
): ScreenViewedProps | null =>
  isScreenViewEvent(event) ? buildScreenViewedProps(event) : null;

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
 * Derives a canonical `screen_name` directly from a React Navigation route
 * name: drop the "Screen" suffix, split PascalCase, lowercase, and join runs
 * of non-alphanumeric chars with a single "_".
 *
 * Examples:
 * - "WelcomeScreen"    → "welcome"
 * - "SettingsScreen"   → "settings"
 * - "SwapAmountScreen" → "swap_amount"
 */
export const routeToScreenName = (routeName: string): string =>
  routeName
    .replace(/Screen$/, "")
    .replace(/([A-Z])/g, " $1") // Add space before capitals
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * Resolves a route to its canonical `screen_name`, or null when the route
 * carries no analytics. A manual override (CUSTOM_ROUTE_MAPPINGS) wins;
 * otherwise the name is derived from the route.
 */
export const processRouteForAnalytics = (routeName: string): string | null => {
  // Check exclusion list first
  if (ROUTES_WITHOUT_ANALYTICS.has(routeName)) {
    return null;
  }

  // Check manual overrides first
  if (CUSTOM_ROUTE_MAPPINGS[routeName]) {
    return CUSTOM_ROUTE_MAPPINGS[routeName];
  }

  // Derive the screen_name directly for all other routes
  return routeToScreenName(routeName);
};

/**
 * Generates the complete route-to-screen_name mapping using ALL_ROUTE_OBJECTS.
 *
 * This function automatically discovers all routes and creates analytics mappings
 * without requiring manual maintenance of route lists.
 */
export const generateRouteToAnalyticsMapping = () => {
  const mapping: Record<string, string | null> = {};

  ALL_ROUTES_OBJECT.forEach((routeObject) => {
    Object.values(routeObject).forEach((routeName) => {
      if (typeof routeName === "string") {
        mapping[routeName] = processRouteForAnalytics(routeName);
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
