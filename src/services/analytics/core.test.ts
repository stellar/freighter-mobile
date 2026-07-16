// Mobile analytics couples to Zustand stores, the RN SDK, and device-info at
// module load — mock all of them here; individual tests set behavior.
//
// Shared mock header for the analytics core suite. Tasks M2–M7 extend this
// file, so the conventions below must stay:
//   • The module under test is loaded via `jest.requireActual("./core")`, NOT
//     an `import ... from "services/analytics/core"`. Two repo-wide mechanisms
//     otherwise hand back a mock instead of the real module: (1) the Jest
//     `^services/(.*)$` moduleNameMapper redirects bare `services/*` imports to
//     `__mocks__/` stubs, and (2) jest.setup.js globally
//     `jest.mock("services/analytics/core", ...)`. `requireActual` with a
//     relative specifier bypasses both. It is a call expression (not an import
//     declaration), so it also satisfies the repo's no-relative-import lint
//     rule, which a literal `import "./core"` would violate.
//   • `@amplitude/analytics-react-native` is mocked with an explicit factory,
//     not a bare auto-mock. Auto-mocking loads the real RN SDK to introspect
//     it, which crashes in the Jest env on native async-storage
//     (`PlatformLocalStorage`). The factory stubs only what core.ts touches.
import { AnalyticsEvent } from "config/analyticsConfig";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";

jest.mock("@amplitude/analytics-react-native", () => ({
  Identify: jest.fn().mockImplementation(() => ({ set: jest.fn() })),
  identify: jest.fn(),
  init: jest.fn(),
  track: jest.fn(),
  setOptOut: jest.fn(),
}));
jest.mock("@amplitude/experiment-react-native-client", () => ({
  Experiment: { initializeWithAmplitudeAnalytics: jest.fn(() => ({})) },
}));
jest.mock("react-native", () => ({ Platform: { OS: "ios", Version: "17.0" } }));
jest.mock("react-native-device-info", () => ({
  getVersion: jest.fn(() => "9.9.9"),
  getBuildNumber: jest.fn(() => "42"),
  getBundleId: jest.fn(() => "org.stellar.freighter"),
}));
jest.mock("config/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock("helpers/isEnv", () => ({ isE2ETest: false }));
jest.mock("services/analytics/constants", () => ({
  AMPLITUDE_API_KEY: "test-key",
  AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY: "test-exp",
  DEBUG_CONFIG: { LOG_PREFIX: "Analytics" },
  TIMING: { THROTTLE_DELAY_MS: 500 },
  ANALYTICS_CONFIG: {
    INCLUDE_COMMON_CONTEXT: true,
    THROTTLE_DUPLICATE_EVENTS: false, // disable throttle in tests for determinism
    BUNDLE_ID_KEY: "Bundle Id",
  },
}));
jest.mock("ducks/analytics", () => ({
  useAnalyticsStore: {
    getState: jest.fn(() => ({ isEnabled: true })),
    subscribe: jest.fn(),
    persist: {
      hasHydrated: jest.fn(() => true),
      onFinishHydration: jest.fn(),
    },
  },
}));
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: {
    getState: jest.fn(() => ({
      network: "testnet",
      account: null,
      allAccounts: [],
    })),
    subscribe: jest.fn(),
  },
}));
jest.mock("ducks/networkInfo", () => ({
  useNetworkStore: {
    getState: jest.fn(() => ({ connectionType: "wifi", effectiveType: "4g" })),
  },
}));
jest.mock("ducks/balances", () => ({
  useBalancesStore: {
    getState: jest.fn(() => ({ isFunded: false, fetchedPublicKey: null })),
  },
}));

// Load the REAL core module (see header for why requireActual + "./core").
const {
  getAccountIdHash,
  getSurface,
  buildCommonContext,
  deriveIdentifyTraits,
  initAnalytics,
  trackAppOpened,
} = jest.requireActual<typeof import("services/analytics/core")>("./core");

describe("getAccountIdHash", () => {
  const PK = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const EXPECTED =
    "f56f6f2c6cf1b9388e3495dfab96f0c55ec5d217f481b2ae45d11b46145c44ef";

  it("returns the lowercase hex SHA-256 of the G-address (cross-platform vector)", () => {
    expect(getAccountIdHash(PK)).toBe(EXPECTED);
  });
  it("is deterministic, 64 hex chars, and differs per key", () => {
    expect(getAccountIdHash(PK)).toBe(getAccountIdHash(PK));
    expect(getAccountIdHash(PK)).toMatch(/^[0-9a-f]{64}$/);
    expect(getAccountIdHash("GABC")).not.toBe(getAccountIdHash("GXYZ"));
  });
});

describe("getSurface", () => {
  // getSurface reads Platform.OS at call time, so we mutate the shared
  // react-native mock's OS per-test and restore it afterwards.
  const { Platform } = jest.requireMock<{ Platform: { OS: string } }>(
    "react-native",
  );
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("maps Platform.OS to the RFC surface value", () => {
    // react-native mock has Platform.OS = "ios"
    expect(getSurface()).toBe("mobile_ios");
  });

  it("maps a non-ios platform to mobile_android", () => {
    Platform.OS = "android";
    expect(getSurface()).toBe("mobile_android");
  });
});

describe("buildCommonContext (four-bucket model)", () => {
  const PK = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  beforeEach(() => {
    (useAuthenticationStore.getState as jest.Mock).mockReturnValue({
      network: "testnet",
      account: { publicKey: PK, importedFromSecretKey: true },
      allAccounts: [{ publicKey: PK, importedFromSecretKey: true }],
    });
    (useBalancesStore.getState as jest.Mock).mockReturnValue({
      isFunded: true,
      fetchedPublicKey: PK,
      fetchedNetwork: "testnet",
    });
  });

  it("emits the reshaped bucket", () => {
    expect(buildCommonContext()).toMatchObject({
      schema_version: "2",
      surface: "mobile_ios",
      network: "TESTNET",
      account_type: "imported_secret_key",
      account_funded: true,
      account_id_hash:
        "f56f6f2c6cf1b9388e3495dfab96f0c55ec5d217f481b2ae45d11b46145c44ef",
    });
  });

  it("drops SDK/legacy fields and never emits is_hardware_account or a public key", () => {
    const ctx = buildCommonContext();
    [
      "publicKey",
      "platform",
      "platformVersion",
      "appVersion",
      "buildVersion",
      "bundleId",
      "connectionType",
      "effectiveType",
      "is_hardware_account",
    ].forEach((k) => expect(ctx).not.toHaveProperty(k));
    expect(JSON.stringify(ctx)).not.toContain(PK);
  });

  it("omits account fields pre-unlock (no active account)", () => {
    (useAuthenticationStore.getState as jest.Mock).mockReturnValue({
      network: "testnet",
      account: null,
      allAccounts: [],
    });
    const ctx = buildCommonContext();
    ["account_id_hash", "account_type", "account_funded"].forEach((k) =>
      expect(ctx).not.toHaveProperty(k),
    );
    expect(ctx).toMatchObject({ schema_version: "2", network: "TESTNET" });
  });

  it("omits account_funded when balances are for a different/unfetched account", () => {
    (useBalancesStore.getState as jest.Mock).mockReturnValue({
      isFunded: true,
      fetchedPublicKey: "G_OTHER",
      fetchedNetwork: "testnet",
    });
    expect(buildCommonContext()).not.toHaveProperty("account_funded");
  });

  it("omits account_funded when the snapshot is for a different network (network switch)", () => {
    // Same active account, but the cached balance snapshot was fetched for a
    // different network - until the async refetch lands, fail closed rather
    // than reporting the old network's funded status against the new network.
    (useBalancesStore.getState as jest.Mock).mockReturnValue({
      isFunded: true,
      fetchedPublicKey: PK,
      fetchedNetwork: "public",
    });
    expect(buildCommonContext()).not.toHaveProperty("account_funded");
  });

  it("labels account_type freighter when the found entry is not imported", () => {
    (useAuthenticationStore.getState as jest.Mock).mockReturnValue({
      network: "testnet",
      account: { publicKey: PK, importedFromSecretKey: false },
      allAccounts: [{ publicKey: PK, importedFromSecretKey: false }],
    });
    expect(buildCommonContext()).toMatchObject({ account_type: "freighter" });
  });

  it("omits account_type when the active account is not resolvable in allAccounts", () => {
    // Active account is set, but allAccounts does not (yet) contain it -
    // e.g. the auth-store update race or drift-recovery path. We must not
    // default to "freighter" and mislabel a possibly-imported account.
    (useAuthenticationStore.getState as jest.Mock).mockReturnValue({
      network: "testnet",
      account: { publicKey: PK, importedFromSecretKey: true },
      allAccounts: [],
    });
    const ctx = buildCommonContext();
    expect(ctx).not.toHaveProperty("account_type");
    // account_id_hash is still derivable from the active public key alone.
    expect(ctx).toHaveProperty(
      "account_id_hash",
      "f56f6f2c6cf1b9388e3495dfab96f0c55ec5d217f481b2ae45d11b46145c44ef",
    );
  });
});

describe("privacy guard", () => {
  const PK = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

  it("never leaks the raw public key: context has account_id_hash, no publicKey, and JSON has no trace of the G-address", () => {
    (useAuthenticationStore.getState as jest.Mock).mockReturnValue({
      network: "testnet",
      account: { publicKey: PK, importedFromSecretKey: true },
      allAccounts: [{ publicKey: PK, importedFromSecretKey: true }],
    });

    const ctx = buildCommonContext();

    expect(ctx).not.toHaveProperty("publicKey");
    expect(ctx).toHaveProperty(
      "account_id_hash",
      "f56f6f2c6cf1b9388e3495dfab96f0c55ec5d217f481b2ae45d11b46145c44ef",
    );
    expect(JSON.stringify(ctx)).not.toContain(PK);
  });
});

describe("deriveIdentifyTraits", () => {
  it("counts accounts and detects imported presence; no hardware trait", () => {
    const accounts = [
      { publicKey: "G1", importedFromSecretKey: false },
      { publicKey: "G2", importedFromSecretKey: true },
    ] as never;
    const t = deriveIdentifyTraits(accounts);
    expect(t).toEqual({ wallet_count: 2, has_imported_account: true });
    expect(t).not.toHaveProperty("has_hardware_wallet");
  });

  it("reports zero/false for an empty account list", () => {
    expect(deriveIdentifyTraits([])).toEqual({
      wallet_count: 0,
      has_imported_account: false,
    });
  });
});

describe("trackAppOpened (one-time connectivity snapshot)", () => {
  it("enriches app.opened with connectivity, surface, and common context", () => {
    initAnalytics();

    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const amplitudeMock = require("@amplitude/analytics-react-native");
    (amplitudeMock.track as jest.Mock).mockClear();

    trackAppOpened({ previousState: "background" });

    expect(amplitudeMock.track).toHaveBeenCalledWith(
      AnalyticsEvent.APP_OPENED,
      expect.objectContaining({
        previousState: "background",
        surface: "mobile_ios",
        connection_type: "wifi",
        effective_type: "4g",
        schema_version: "2",
      }),
    );
  });
});

describe("syncIdentifyTraits (consent gating)", () => {
  it("does not cache or send Identify while opted out; sends once opted in with the same traits", () => {
    // syncIdentifyTraits guards on module-level `hasInitialised`/fingerprint
    // state that would otherwise be shared with the other describe blocks in
    // this file (which never call initAnalytics), so isolate the module here
    // to get a fresh, independently-initializable instance. Mirrors the
    // extension's helpers/metrics.test.ts pattern for the same fix.
    const accounts = [
      { publicKey: "G1", importedFromSecretKey: true },
    ] as never;

    let mod: typeof import("services/analytics/core");
    let isolatedAnalyticsStore: { getState: jest.Mock };
    let isolatedIdentify: jest.Mock;

    jest.isolateModules(() => {
      mod =
        jest.requireActual<typeof import("services/analytics/core")>("./core");
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      isolatedAnalyticsStore = require("ducks/analytics").useAnalyticsStore;
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      const amplitudeMock = require("@amplitude/analytics-react-native");
      isolatedIdentify = amplitudeMock.identify as jest.Mock;
    });

    isolatedAnalyticsStore!.getState.mockReturnValue({ isEnabled: false });
    mod!.initAnalytics();
    isolatedIdentify!.mockClear();

    // Opted out: no Identify sent, and (critically) the fingerprint must NOT
    // be cached, so the same call after opt-in below still sends.
    mod!.syncIdentifyTraits(accounts);
    expect(isolatedIdentify!).not.toHaveBeenCalled();

    // Opt in with the same traits: must send now, proving nothing was
    // cached while opted out (otherwise the dirty-check would suppress it).
    isolatedAnalyticsStore!.getState.mockReturnValue({ isEnabled: true });
    mod!.syncIdentifyTraits(accounts);
    expect(isolatedIdentify!).toHaveBeenCalled();
  });

  it("sends the initial Identify during initAnalytics when enabled (proves the in-init sync runs after hasInitialised is set)", () => {
    // Regression guard for the ordering bug: the in-init syncIdentifyTraits
    // call must run AFTER `hasInitialised = true`, otherwise its own
    // !hasInitialised gate short-circuits and an already-logged-in user
    // (whose allAccounts never changes again) gets no Identify all session.
    let mod: typeof import("services/analytics/core");
    let isolatedAnalyticsStore: { getState: jest.Mock };
    let isolatedAuthStore: { getState: jest.Mock; subscribe: jest.Mock };
    let isolatedIdentify: jest.Mock;

    jest.isolateModules(() => {
      mod =
        jest.requireActual<typeof import("services/analytics/core")>("./core");
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      isolatedAnalyticsStore = require("ducks/analytics").useAnalyticsStore;
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      isolatedAuthStore = require("ducks/auth").useAuthenticationStore;
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      const amplitudeMock = require("@amplitude/analytics-react-native");
      isolatedIdentify = amplitudeMock.identify as jest.Mock;
    });

    isolatedAnalyticsStore!.getState.mockReturnValue({ isEnabled: true });
    isolatedAuthStore!.getState.mockReturnValue({
      network: "testnet",
      account: null,
      allAccounts: [{ publicKey: "G1", importedFromSecretKey: true }],
    });
    isolatedIdentify!.mockClear();

    mod!.initAnalytics();

    expect(isolatedIdentify!).toHaveBeenCalled();
  });

  it("sends Identify when consent is enabled after init (via the analytics-store subscription)", () => {
    // Consent (isEnabled, persisted to AsyncStorage) may hydrate/enable AFTER
    // init, so the in-init sync correctly skips (opted-out, nothing cached).
    // The analytics-store subscription must then re-sync so traits still land.
    let mod: typeof import("services/analytics/core");
    let isolatedAnalyticsStore: { getState: jest.Mock; subscribe: jest.Mock };
    let isolatedAuthStore: { getState: jest.Mock };
    let isolatedIdentify: jest.Mock;

    jest.isolateModules(() => {
      mod =
        jest.requireActual<typeof import("services/analytics/core")>("./core");
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      isolatedAnalyticsStore = require("ducks/analytics").useAnalyticsStore;
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      isolatedAuthStore = require("ducks/auth").useAuthenticationStore;
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      const amplitudeMock = require("@amplitude/analytics-react-native");
      isolatedIdentify = amplitudeMock.identify as jest.Mock;
    });

    isolatedAuthStore!.getState.mockReturnValue({
      network: "testnet",
      account: null,
      allAccounts: [{ publicKey: "G1", importedFromSecretKey: true }],
    });

    // Init while opted out: no Identify, nothing cached.
    isolatedAnalyticsStore!.getState.mockReturnValue({ isEnabled: false });
    mod!.initAnalytics();
    isolatedIdentify!.mockClear();

    // Consent enables: flip the store, then invoke the subscription callback
    // core.ts registered at module load (the analytics-store subscriber). The
    // subscribe mock is a shared jest.fn that accumulates a registration from
    // every core module load in this suite, so take the LAST one - the
    // subscriber bound to THIS isolated module (whose hasInitialised is true).
    isolatedAnalyticsStore!.getState.mockReturnValue({ isEnabled: true });
    const { calls } = isolatedAnalyticsStore!.subscribe.mock;
    const subscriber = calls[calls.length - 1][0] as (state: {
      isEnabled: boolean;
    }) => void;
    subscriber({ isEnabled: true });

    expect(isolatedIdentify!).toHaveBeenCalled();
  });

  it("does not send Identify before consent has hydrated, then syncs once hydration finishes", () => {
    // Consent is persisted and hydrates asynchronously; the pre-hydration
    // in-memory default is `true` on Android, so reading it now could emit
    // traits for a user whose stored preference is opt-out. Must wait for
    // hydration, then retry via onFinishHydration.
    const accounts = [
      { publicKey: "G1", importedFromSecretKey: true },
    ] as never;

    let mod: typeof import("services/analytics/core");
    let store: {
      getState: jest.Mock;
      persist: { hasHydrated: jest.Mock; onFinishHydration: jest.Mock };
    };
    let identify: jest.Mock;

    jest.isolateModules(() => {
      mod =
        jest.requireActual<typeof import("services/analytics/core")>("./core");
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      store = require("ducks/analytics").useAnalyticsStore;
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      identify = require("@amplitude/analytics-react-native")
        .identify as jest.Mock;
    });

    store!.persist.onFinishHydration.mockClear();
    store!.persist.hasHydrated.mockReturnValue(false);
    store!.getState.mockReturnValue({ isEnabled: true }); // default, not yet persisted

    mod!.initAnalytics();
    identify!.mockClear();

    // Not hydrated: neither init nor a direct call may emit.
    mod!.syncIdentifyTraits(accounts);
    expect(identify!).not.toHaveBeenCalled();
    expect(store!.persist.onFinishHydration).toHaveBeenCalled();

    // Hydration finishes → the registered callback re-syncs with the now
    // authoritative (still enabled) consent value.
    store!.persist.hasHydrated.mockReturnValue(true);
    const onFinish = store!.persist.onFinishHydration.mock.calls.at(
      -1,
    )![0] as () => void;
    onFinish();
    expect(identify!).toHaveBeenCalled();

    // Restore the shared mock default for any later test.
    store!.persist.hasHydrated.mockReturnValue(true);
  });

  it("retries Identify after a failed send (fingerprint cached only on success)", () => {
    // If amplitude.identify throws once, the fingerprint must NOT be cached, so
    // a later call with the same traits still retries rather than being
    // suppressed by the dirty-check.
    const accounts = [
      { publicKey: "G1", importedFromSecretKey: true },
    ] as never;

    let mod: typeof import("services/analytics/core");
    let store: { getState: jest.Mock };
    let authStore: { getState: jest.Mock };
    let identify: jest.Mock;

    jest.isolateModules(() => {
      mod =
        jest.requireActual<typeof import("services/analytics/core")>("./core");
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      store = require("ducks/analytics").useAnalyticsStore;
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      authStore = require("ducks/auth").useAuthenticationStore;
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      identify = require("@amplitude/analytics-react-native")
        .identify as jest.Mock;
    });

    store!.getState.mockReturnValue({ isEnabled: true });
    // Init syncs with an EMPTY account list so its cached fingerprint differs
    // from `accounts` below (otherwise the dirty-check would suppress the call
    // under test for the wrong reason).
    authStore!.getState.mockReturnValue({
      network: "testnet",
      account: null,
      allAccounts: [],
    });
    mod!.initAnalytics();
    identify!.mockClear();

    // First send throws; the catch swallows it and must leave nothing cached.
    identify!.mockImplementationOnce(() => {
      throw new Error("network blip");
    });
    mod!.syncIdentifyTraits(accounts);
    expect(identify!).toHaveBeenCalledTimes(1);

    // Same traits again: since the failed send wasn't cached, this retries.
    identify!.mockClear();
    mod!.syncIdentifyTraits(accounts);
    expect(identify!).toHaveBeenCalledTimes(1);
  });
});
