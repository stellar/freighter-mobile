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
//   • `helpers/stellar` is mocked because core.ts imports `truncateAddress`
//     from it and there is no `__mocks__/helpers/stellar` stub.
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
jest.mock("helpers/stellar", () => ({ truncateAddress: (a: string) => a }));
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
  it("maps Platform.OS to the RFC surface value", () => {
    // react-native mock has Platform.OS = "ios"
    expect(getSurface()).toBe("mobile_ios");
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
      isolatedIdentify =
        // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
        (
          require("@amplitude/analytics-react-native") as typeof import("@amplitude/analytics-react-native")
        ).identify as jest.Mock;
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
});
