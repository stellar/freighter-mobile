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
  // surface, step? } instead of a distinct "loaded screen: X" event. The
  // VIEW_* members below are retained as the canonical legacy-screen-string
  // catalog: `screen_name` is derived deterministically from their string
  // values (see deriveScreenName), and they remain the keys that components
  // firing screen views manually (bottom sheets / detail sheets) reference.
  // After the cutover their "loaded screen: X" string values are used
  // only as catalog keys and are NEVER emitted to Amplitude.
  SCREEN_VIEWED = "screen.viewed",

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
  VIEW_SIGN_DAPP_AUTH_ENTRY_DETAILS = "loaded screen: sign auth entry details",
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
 * - `screen_name`: canonical, cross-platform id — declared in SCREEN_CATALOG
 *   for named screens, derived (deriveScreenName) for auto-mapped routes.
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

const LEGACY_SCREEN_PREFIX = "loaded screen: ";

/**
 * Per-screen catalog for named screens: the canonical `screen_name`
 * (declared explicitly so the analytics id is decoupled from the mutable
 * display string) plus its `flow` and optional `step`. Keyed by the legacy
 * "loaded screen: X" string. Routes NOT listed here (auto-mapped via
 * transformRouteToEventName) fall back to a derived `screen_name` and carry
 * no `flow` — see buildScreenViewedProps / deriveScreenName.
 */
const SCREEN_CATALOG: Record<
  string,
  { screen_name: string; flow?: AnalyticsFlow; step?: string }
> = {
  // Onboarding / account creation
  [AnalyticsEvent.VIEW_WELCOME]: {
    screen_name: "welcome",
    flow: AnalyticsFlow.ONBOARDING,
  },
  [AnalyticsEvent.VIEW_CHOOSE_PASSWORD]: {
    screen_name: "account_creator",
    flow: AnalyticsFlow.ONBOARDING,
  },
  [AnalyticsEvent.VIEW_RECOVERY_PHRASE_ALERT]: {
    screen_name: "mnemonic_phrase_alert",
    flow: AnalyticsFlow.ONBOARDING,
  },
  [AnalyticsEvent.VIEW_RECOVERY_PHRASE]: {
    screen_name: "mnemonic_phrase",
    flow: AnalyticsFlow.ONBOARDING,
  },
  [AnalyticsEvent.VIEW_VALIDATE_RECOVERY_PHRASE]: {
    screen_name: "confirm_mnemonic_phrase",
    flow: AnalyticsFlow.ONBOARDING,
  },
  [AnalyticsEvent.VIEW_IMPORT_WALLET]: {
    screen_name: "recover_account",
    flow: AnalyticsFlow.ONBOARDING,
  },
  // Security / re-auth / secret material
  [AnalyticsEvent.VIEW_LOCK_SCREEN]: {
    screen_name: "unlock_account",
    flow: AnalyticsFlow.SECURITY,
  },
  [AnalyticsEvent.VIEW_SECURITY]: {
    screen_name: "security",
    flow: AnalyticsFlow.SECURITY,
  },
  [AnalyticsEvent.VIEW_SHOW_RECOVERY_PHRASE]: {
    screen_name: "show_recovery_phrase",
    flow: AnalyticsFlow.SECURITY,
  },
  [AnalyticsEvent.VIEW_IMPORT_SECRET_KEY]: {
    screen_name: "import_secret_key",
    flow: AnalyticsFlow.SECURITY,
  },
  // Home / assets
  [AnalyticsEvent.VIEW_HOME]: {
    screen_name: "account",
    flow: AnalyticsFlow.ASSETS,
  },
  [AnalyticsEvent.VIEW_TOKEN_DETAILS]: {
    screen_name: "asset_detail",
    flow: AnalyticsFlow.ASSETS,
  },
  [AnalyticsEvent.VIEW_ACCOUNT_QR_CODE]: {
    screen_name: "view_public_key_generator",
    flow: AnalyticsFlow.ASSETS,
  },
  [AnalyticsEvent.VIEW_MANAGE_TOKENS]: {
    screen_name: "manage_assets",
    flow: AnalyticsFlow.ASSETS,
  },
  [AnalyticsEvent.VIEW_ADD_TOKEN]: {
    screen_name: "add_asset",
    flow: AnalyticsFlow.ASSETS,
  },
  [AnalyticsEvent.VIEW_REMOVE_TOKEN]: {
    screen_name: "remove_asset",
    flow: AnalyticsFlow.ASSETS,
  },
  [AnalyticsEvent.VIEW_SEARCH_TOKEN]: {
    screen_name: "search_asset",
    flow: AnalyticsFlow.ASSETS,
  },
  [AnalyticsEvent.VIEW_ADD_TOKEN_MANUALLY]: {
    screen_name: "add_asset_manually",
    flow: AnalyticsFlow.ASSETS,
  },
  [AnalyticsEvent.VIEW_BUY_XLM]: {
    screen_name: "add_fund",
    flow: AnalyticsFlow.ASSETS,
  },
  // History
  [AnalyticsEvent.VIEW_HISTORY]: {
    screen_name: "account_history",
    flow: AnalyticsFlow.HISTORY,
  },
  // Discovery
  [AnalyticsEvent.VIEW_DISCOVERY]: {
    screen_name: "discover",
    flow: AnalyticsFlow.DISCOVERY,
  },
  // Signing / dApp
  [AnalyticsEvent.VIEW_GRANT_DAPP_ACCESS]: {
    screen_name: "grant_access",
    flow: AnalyticsFlow.SIGNING,
  },
  [AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION]: {
    screen_name: "sign_transaction",
    flow: AnalyticsFlow.SIGNING,
  },
  [AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION_DETAILS]: {
    screen_name: "sign_transaction_details",
    flow: AnalyticsFlow.SIGNING,
  },
  [AnalyticsEvent.VIEW_SIGN_DAPP_AUTH_ENTRY_DETAILS]: {
    screen_name: "sign_auth_entry_details",
    flow: AnalyticsFlow.SIGNING,
  },
  // Send payment
  [AnalyticsEvent.VIEW_SEND_SEARCH_CONTACTS]: {
    screen_name: "send_payment_to",
    flow: AnalyticsFlow.SEND,
  },
  [AnalyticsEvent.VIEW_SEND_AMOUNT]: {
    screen_name: "send_payment_amount",
    flow: AnalyticsFlow.SEND,
  },
  [AnalyticsEvent.VIEW_SEND_MEMO]: {
    screen_name: "send_payment_settings",
    flow: AnalyticsFlow.SEND,
  },
  [AnalyticsEvent.VIEW_SEND_FEE]: {
    screen_name: "send_payment_fee",
    flow: AnalyticsFlow.SEND,
  },
  [AnalyticsEvent.VIEW_SEND_TIMEOUT]: {
    screen_name: "send_payment_timeout",
    flow: AnalyticsFlow.SEND,
  },
  [AnalyticsEvent.VIEW_SEND_CONFIRM]: {
    screen_name: "send_payment_confirm",
    flow: AnalyticsFlow.SEND,
    step: "confirm",
  },
  [AnalyticsEvent.VIEW_SEND_TRANSACTION_DETAILS]: {
    screen_name: "send_transaction_details",
    flow: AnalyticsFlow.SEND,
  },
  [AnalyticsEvent.VIEW_SEND_PROCESSING]: {
    screen_name: "send_payment_processing",
    flow: AnalyticsFlow.SEND,
    step: "processing",
  },
  // Swap
  [AnalyticsEvent.VIEW_SWAP]: { screen_name: "swap", flow: AnalyticsFlow.SWAP },
  [AnalyticsEvent.VIEW_SWAP_AMOUNT]: {
    screen_name: "swap_amount",
    flow: AnalyticsFlow.SWAP,
  },
  [AnalyticsEvent.VIEW_SWAP_FEE]: {
    screen_name: "swap_fee",
    flow: AnalyticsFlow.SWAP,
  },
  [AnalyticsEvent.VIEW_SWAP_SLIPPAGE]: {
    screen_name: "swap_slippage",
    flow: AnalyticsFlow.SWAP,
  },
  [AnalyticsEvent.VIEW_SWAP_TIMEOUT]: {
    screen_name: "swap_timeout",
    flow: AnalyticsFlow.SWAP,
  },
  [AnalyticsEvent.VIEW_SWAP_SETTINGS]: {
    screen_name: "swap_settings",
    flow: AnalyticsFlow.SWAP,
  },
  [AnalyticsEvent.VIEW_SWAP_CONFIRM]: {
    screen_name: "swap_confirm",
    flow: AnalyticsFlow.SWAP,
    step: "confirm",
  },
  [AnalyticsEvent.VIEW_SWAP_TRANSACTION_DETAILS]: {
    screen_name: "swap_transaction_details",
    flow: AnalyticsFlow.SWAP,
  },
  // Settings
  [AnalyticsEvent.VIEW_SETTINGS]: {
    screen_name: "settings",
    flow: AnalyticsFlow.SETTINGS,
  },
  [AnalyticsEvent.VIEW_PREFERENCES]: {
    screen_name: "preferences",
    flow: AnalyticsFlow.SETTINGS,
  },
  [AnalyticsEvent.VIEW_CHANGE_NETWORK]: {
    screen_name: "manage_network",
    flow: AnalyticsFlow.SETTINGS,
  },
  [AnalyticsEvent.VIEW_NETWORK_SETTINGS]: {
    screen_name: "network_settings",
    flow: AnalyticsFlow.SETTINGS,
  },
  [AnalyticsEvent.VIEW_SHARE_FEEDBACK]: {
    screen_name: "leave_feedback",
    flow: AnalyticsFlow.SETTINGS,
  },
  [AnalyticsEvent.VIEW_ABOUT]: {
    screen_name: "about",
    flow: AnalyticsFlow.SETTINGS,
  },
  [AnalyticsEvent.VIEW_MANAGE_CONNECTED_APPS]: {
    screen_name: "manage_connected_apps",
    flow: AnalyticsFlow.SETTINGS,
  },
  [AnalyticsEvent.VIEW_MANAGE_WALLETS]: {
    screen_name: "manage_wallets",
    flow: AnalyticsFlow.SETTINGS,
  },
};

/**
 * Fallback `screen_name` derivation for routes NOT declared in SCREEN_CATALOG
 * (auto-mapped via transformRouteToEventName). Named screens declare their
 * `screen_name` explicitly in the catalog; this only runs for the auto-mapped
 * long tail. Deterministic transform of a legacy "loaded screen: X" string:
 *   1. strip the "loaded screen: " prefix
 *   2. trim
 *   3. lowercase
 *   4. replace each run of non-alphanumeric chars with a single "_"
 *
 * e.g. "loaded screen: send payment amount" -> "send_payment_amount"
 *      "loaded screen: account"             -> "account"
 */
export const deriveScreenName = (legacyEvent: string): string =>
  legacyEvent
    .replace(/^loaded screen:\s*/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * True when `event` is a legacy screen-load event (its value should be
 * retargeted to the canonical `screen.viewed` event rather than emitted).
 */
export const isScreenViewEvent = (event: string): boolean =>
  event.startsWith(LEGACY_SCREEN_PREFIX);

/**
 * Builds the `screen.viewed` property bag from a legacy "loaded screen: X"
 * string: the catalogued `screen_name` (or a derived one for auto-mapped
 * routes) plus the screen's `flow`/`step` from the catalog (omitted when none).
 */
export const buildScreenViewedProps = (
  legacyEvent: string,
): ScreenViewedProps => {
  const entry = SCREEN_CATALOG[legacyEvent];
  const props: ScreenViewedProps = {
    // Catalogued screens declare their `screen_name` explicitly; auto-mapped
    // routes (transformRouteToEventName) that aren't in the catalog fall back
    // to a derived name so they still emit a non-empty `screen_name`.
    screen_name: entry?.screen_name ?? deriveScreenName(legacyEvent),
  };
  if (entry?.flow) props.flow = entry.flow;
  if (entry?.step) props.step = entry.step;
  return props;
};

/**
 * Retargeting helper for manual screen-view emission sites (e.g. bottom
 * sheets that present a "screen"). Returns the `screen.viewed` props for a
 * legacy screen-load event, or null for any non-screen event (which should be
 * tracked unchanged).
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
