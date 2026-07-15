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
const { getAccountIdHash } =
  jest.requireActual<typeof import("services/analytics/core")>("./core");

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
