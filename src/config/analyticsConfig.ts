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

  // ---------------------------------------------------------------------------
  // Domain (action / outcome) events (#2883)
  //
  // Wire strings follow the shared cross-platform grammar `domain.action_past`
  // (dot domain, snake_case verb phrase). Terminal outcomes are separate events
  // (`completed` / `failed` / `rejected` / `blocked` / `submitted`). Several
  // legacy events collapse into one event carrying a discriminator property
  // (scan_target / decision / side / payment_type / safety / operation /
  // reason_code) supplied at the call site. `schema_version`, `surface`,
  // `network` and `account_id_hash` are added by buildCommonContext and must
  // NOT be hand-added at call sites.
  // ---------------------------------------------------------------------------

  // Onboarding / account creation
  CREATE_PASSWORD_SUCCESS = "onboarding.password_created",
  // carries reason_code
  CREATE_PASSWORD_FAIL = "onboarding.password_create_failed",
  VIEWED_RECOVERY_PHRASE = "onboarding.recovery_phrase_viewed",
  CONFIRM_RECOVERY_PHRASE_SUCCESS = "onboarding.recovery_phrase_confirmed",
  // carries reason_code
  CONFIRM_RECOVERY_PHRASE_FAIL = "onboarding.recovery_phrase_confirm_failed",
  ACCOUNT_CREATOR_CONFIRM_MNEMONIC_BACK = "onboarding.recovery_phrase_back_clicked",
  ACCOUNT_CREATOR_FINISHED = "onboarding.completed",

  // Authentication / recovery
  // NOTE: re-auth has no cross-platform mapping in #2883; the grammar is
  // applied consistently here (terminal completed / failed) and flagged for
  // review.
  RE_AUTH_SUCCESS = "reauth.completed",
  RE_AUTH_FAIL = "reauth.failed",
  RECOVER_ACCOUNT_SUCCESS = "account_recovery.completed",
  // carries reason_code
  RECOVER_ACCOUNT_FAIL = "account_recovery.failed",

  // Payments / send
  // payment.completed carries payment_type (payment | path_payment). Path /
  // routed payment outcomes are reported as swaps (see the analytics helper),
  // so a path-payment success emits swap.completed and a failure swap.failed.
  SEND_PAYMENT_SUCCESS = "payment.completed",
  // carries reason_code (direct payments only; path outcomes -> swap.failed)
  SEND_PAYMENT_FAIL = "payment.failed",
  SEND_PAYMENT_SET_MAX = "payment.max_amount_selected",
  // Consolidates the direct / path payment-type selections; carries
  // payment_type (payment | path_payment).
  PAYMENT_TYPE_SELECTED = "payment.type_selected",
  SEND_PAYMENT_RECENT_ADDRESS = "payment.recipient_recent_selected",
  // carries reason_code
  SIMULATE_TOKEN_PAYMENT_ERROR = "payment.simulation_failed",

  // Swap
  SWAP_SUCCESS = "swap.completed",
  // carries reason_code
  SWAP_FAIL = "swap.failed",
  // Consolidates the to-/from-picker opened events; carries side (from | to).
  SWAP_PICKER_OPENED = "swap.picker_opened",
  SWAP_DIRECTION_TOGGLED = "swap.direction_toggled",
  SWAP_TRENDING_TOKEN_TAPPED = "swap.trending_token_tapped",
  SWAP_TRENDING_SWAP_TO_PRESSED = "swap.trending_swap_to_pressed",
  SWAP_DESTINATION_SELECTED = "swap.destination_selected",
  SWAP_SOURCE_SELECTED = "swap.source_selected",
  SWAP_TRUSTLINE_ADDED = "swap.trustline_added",
  SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN = "swap.xlm_reserve_insufficient_shown",
  SWAP_QUOTE_EXPIRED = "swap.quote_expired",

  // Send collectible
  SEND_COLLECTIBLE_SUCCESS = "collectible_send.completed",
  // carries reason_code
  SEND_COLLECTIBLE_FAIL = "collectible_send.failed",

  // Signing / dApp
  GRANT_DAPP_ACCESS_SUCCESS = "dapp_access.granted",
  GRANT_DAPP_ACCESS_FAIL = "dapp_access.rejected",
  SIGN_TRANSACTION_SUCCESS = "signing.transaction_approved",
  SIGN_TRANSACTION_FAIL = "signing.transaction_rejected",
  // carries reason_code=memo_required
  SIGN_TRANSACTION_MEMO_REQUIRED_FAIL = "signing.transaction_blocked",
  SUBMIT_TRANSACTION_SUCCESS = "transaction.submitted",
  SIGN_MESSAGE_SUCCESS = "signing.message_approved",
  // Runtime signing failure (carries reason_code).
  SIGN_MESSAGE_FAIL = "signing.message_failed",
  // Catalog member for the user-reject case. The mobile reject path currently
  // has no analytics call, so this is not emitted yet; kept for cross-platform
  // parity and flagged for review.
  SIGN_MESSAGE_REJECTED = "signing.message_rejected",
  SIGN_AUTH_ENTRY_SUCCESS = "signing.auth_entry_approved",
  // Runtime signing failure (carries reason_code).
  SIGN_AUTH_ENTRY_FAIL = "signing.auth_entry_failed",
  // Catalog member for the user-reject case; see SIGN_MESSAGE_REJECTED.
  SIGN_AUTH_ENTRY_REJECTED = "signing.auth_entry_rejected",

  // Assets / trustlines
  // asset.added carries asset_code + asset (CODE:ISSUER).
  ADD_TOKEN_SUCCESS = "asset.added",
  REMOVE_TOKEN_SUCCESS = "asset.removed",
  // carries operation (add | remove) + reason_code
  TOKEN_MANAGEMENT_FAIL = "asset.operation_failed",
  // Consolidates the add-token confirmed / rejected prompt responses; carries
  // decision (confirm | reject) + source.
  ASSET_ADD_RESPONDED = "asset_add.responded",
  // Consolidates the remove-token confirmed / rejected prompt responses;
  // carries decision (confirm | reject).
  ASSET_REMOVE_RESPONDED = "asset_remove.responded",
  MANAGE_TOKEN_LISTS_MODIFY = "asset_list.modified",
  // Consolidates the three trustline-removal failure reasons; carries
  // reason_code (has_balance | buying_liabilities | low_reserve).
  TRUSTLINE_REMOVE_FAILED = "trustline_remove.failed",

  // Account management
  ACCOUNT_SCREEN_ADD_ACCOUNT = "account.created",
  ACCOUNT_SCREEN_IMPORT_ACCOUNT = "account.imported",
  // carries reason_code
  ACCOUNT_SCREEN_IMPORT_ACCOUNT_FAIL = "account.import_failed",
  VIEW_PUBLIC_KEY_ACCOUNT_RENAMED = "account.renamed",
  COPY_PUBLIC_KEY = "account.public_key_copied",
  VIEW_PUBLIC_KEY_CLICKED_STELLAR_EXPERT = "account.stellar_expert_opened",

  // Recovery phrase
  COPY_BACKUP_PHRASE = "recovery_phrase.copied",
  DOWNLOAD_BACKUP_PHRASE = "recovery_phrase.downloaded",

  // History
  HISTORY_OPEN_FULL_HISTORY = "history.full_history_opened",
  HISTORY_OPEN_ITEM = "history.item_opened",

  // Canonical app-open event (property-model foundation, #2883).
  APP_OPENED = "event: App Opened",

  // Blockaid
  // Consolidates the four scan events; carries scan_target
  // (domain | transaction | asset | asset_bulk) + result. A scan failure emits
  // BLOCKAID_SCAN_FAILED (scan_target + reason_code).
  BLOCKAID_SCAN_COMPLETED = "blockaid.scan_completed",
  BLOCKAID_SCAN_FAILED = "blockaid.scan_failed",

  // Onramp
  COINBASE_ONRAMP_OPENED = "onramp.coinbase_opened",

  // Discover
  DISCOVER_PROTOCOL_OPENED = "discover.protocol_opened",
  DISCOVER_PROTOCOL_DETAILS_VIEWED = "discover.protocol_details_viewed",
  DISCOVER_PROTOCOL_OPENED_FROM_DETAILS = "discover.protocol_opened_from_details",
  DISCOVER_TAB_CREATED = "discover.tab_created",
  DISCOVER_TAB_CLOSED = "discover.tab_closed",
  DISCOVER_ALL_TABS_CLOSED = "discover.all_tabs_closed",
  DISCOVER_WELCOME_MODAL_VIEWED = "discover.welcome_modal_viewed",

  // Platform-only events (retained; renamed to the shared grammar)
  QR_SCAN_SUCCESS = "qr_scan.completed",
  // carries reason_code
  QR_SCAN_ERROR = "qr_scan.failed",
  // Consolidates the banner / screen store-open events; carries
  // source (banner | screen).
  APP_UPDATE_STORE_OPENED = "app_update.store_opened",
  APP_UPDATE_CONFIRMED_SKIP_ON_SCREEN = "app_update.skip_confirmed",
  DEVICE_JAILBREAK_DETECTED = "device_security.jailbreak_detected",
  // carries reason_code
  DEVICE_JAILBREAK_FAILED = "device_security.jailbreak_detection_failed",
}

/**
 * Tags how the user reached the Swap source / destination picker, carried as
 * the `source` property on the SWAP_PICKER_OPENED analytics event.
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
