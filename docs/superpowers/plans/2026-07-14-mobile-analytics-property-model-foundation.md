# Mobile Analytics Property-Model Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax.

**Goal:** Bring freighter-mobile's Amplitude property model to the RFC
four-bucket schema (mirroring extension #2903), without renaming events.

**Architecture:** Evolve `freighter-mobile/src/services/analytics/core.ts` in
place. Add `schema_version`, `account_id_hash`, `getSurface`
(`mobile_ios`/`mobile_android`), Identify traits, and enrich `app.opened`;
derive `account_funded` from the balances store (new `fetchedPublicKey` gate).
Two cross-platform touch-points ride along: an extension #2903 follow-up
(sticky→balances) and an RFC #23 note.

**Tech Stack:** TypeScript, React Native, `@amplitude/analytics-react-native`,
Zustand stores, `@stellar/stellar-sdk` (`hash`), Jest (`react-native` preset).

**Spec:**
`docs/superpowers/specs/2026-07-14-mobile-analytics-property-model-foundation.md`

## Global Constraints

- **No event renames** (legacy names stay; `app.opened` keeps its legacy string
  `"event: App Opened"`).
- **Hard cutover, no dual-write.** `schema_version` value is the string `"2"`.
- **Never emit a raw or truncated public key.** Account identity =
  `account_id_hash` = `hash(Buffer.from(publicKey,"utf8")).toString("hex")`
  (lowercase hex SHA-256 of the full G-address). Must match the committed vector
  `GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF` →
  `f56f6f2c6cf1b9388e3495dfab96f0c55ec5d217f481b2ae45d11b46145c44ef`.
- **Omit both** `is_hardware_account` (event) and `has_hardware_wallet`
  (Identify) — mobile has no hardware wallets.
- **`account_funded`**: derive from the balances store; emit only when
  `fetchedPublicKey === activePublicKey`, else **omit** (never emit a misleading
  `false`).
- **`wallet_count` = `allAccounts.length`.**
- **Do not enable behavioral autocapture.** Keep the existing throttle/dedupe
  dispatcher and opt-out subscription.
- **Identity/`user_id`** is out of scope (owned by mobile #864).
- Conventional Commit prefixes.

## File Structure

| File                                  | Change                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/analytics/core.ts`      | Modify — buildCommonContext, init/Identify, trackAppOpened; add getAccountIdHash/getSurface/syncIdentifyTraits + auth-store subscription |
| `src/ducks/balances.ts`               | Modify — add `fetchedPublicKey` field                                                                                                    |
| `src/services/analytics/core.test.ts` | **Create** — no analytics tests exist yet                                                                                                |

Cross-repo touch-points (separate tasks, other repos): extension `freighter` and
monorepo `wallet-eng-monorepo`.

---

## Task M1: `getAccountIdHash` + test scaffolding

**Files:** Modify `src/services/analytics/core.ts`; Create
`src/services/analytics/core.test.ts`

**Interfaces:** Produces `getAccountIdHash(publicKey: string): string` —
memoized lowercase-hex SHA-256 of the G-address; `""` on error.

- [ ] **Step 1: Create the test file with the shared mock header + failing
      test**

Create `src/services/analytics/core.test.ts`:

```ts
import { getAccountIdHash } from "services/analytics/core";

// Mobile analytics couples to Zustand stores, the RN SDK, and device-info at
// module load — mock all of them here; individual tests set behavior.
jest.mock("@amplitude/analytics-react-native");
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn jest src/services/analytics/core.test.ts -t getAccountIdHash`
Expected: FAIL — `getAccountIdHash is not a function`.

- [ ] **Step 3: Implement in `core.ts`**

Add import near the top: `import { hash } from "@stellar/stellar-sdk";`

Add in the CORE TRACKING region (before `buildCommonContext`):

```ts
/**
 * Cross-platform account identifier: lowercase-hex SHA-256 of the full
 * G-address string. Memoized; never emits a raw/truncated key. Must match the
 * extension's value for the same address.
 */
const accountIdHashCache = new Map<string, string>();
export const getAccountIdHash = (publicKey: string): string => {
  const cached = accountIdHashCache.get(publicKey);
  if (cached) return cached;
  try {
    const digest = hash(Buffer.from(publicKey, "utf8")).toString("hex");
    accountIdHashCache.set(publicKey, digest);
    return digest;
  } catch {
    return "";
  }
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn jest src/services/analytics/core.test.ts -t getAccountIdHash` → PASS
(2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/analytics/core.ts src/services/analytics/core.test.ts
git commit -m "feat(analytics): add memoized account_id_hash helper"
```

---

## Task M2: `getSurface()`

**Files:** Modify `core.ts`; Test `core.test.ts` **Interfaces:** Produces
`type Surface = "mobile_ios" | "mobile_android"`; `getSurface(): Surface`.

- [ ] **Step 1: Failing test** — add to `core.test.ts`:

```ts
import { getSurface } from "services/analytics/core";

describe("getSurface", () => {
  it("maps Platform.OS to the RFC surface value", () => {
    // react-native mock has Platform.OS = "ios"
    expect(getSurface()).toBe("mobile_ios");
  });
});
```

- [ ] **Step 2: Run** —
      `yarn jest src/services/analytics/core.test.ts -t getSurface` → FAIL.

- [ ] **Step 3: Implement** — `core.ts` already imports
      `{ Platform } from "react-native"`. Add:

```ts
export type Surface = "mobile_ios" | "mobile_android";
export const getSurface = (): Surface =>
  Platform.OS === "ios" ? "mobile_ios" : "mobile_android";
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** — `feat(analytics): add mobile surface helper`

---

## Task M3: balances store `fetchedPublicKey`

**Files:** Modify `src/ducks/balances.ts`; Test `src/ducks/balances.test.ts`
(extend if present, else create a focused test) **Interfaces:** Produces
`BalancesState.fetchedPublicKey: string | null`, set to the fetched key when
`fetchAccountBalances` succeeds.

- [ ] **Step 1: Failing test** — assert that after a successful
      `fetchAccountBalances({publicKey})`, the store's `fetchedPublicKey` equals
      that publicKey. (Mock `fetchBalances` to resolve
      `{balances:{}, isFunded:false, subentryCount:0}`.) If mocking the fetch
      chain is heavy, instead assert the reducer-level `set` includes
      `fetchedPublicKey` by unit-testing a small extracted setter — but prefer
      the store-level test.

```ts
// src/ducks/balances.test.ts (illustrative; adapt mocks to existing patterns)
it("records fetchedPublicKey after a successful fetch", async () => {
  // arrange: mock fetchBalances to resolve empty/funded=false
  await useBalancesStore
    .getState()
    .fetchAccountBalances({ publicKey: "G_TEST", network: NETWORKS.TESTNET });
  expect(useBalancesStore.getState().fetchedPublicKey).toBe("G_TEST");
});
```

- [ ] **Step 2: Run** → FAIL (`fetchedPublicKey` undefined).

- [ ] **Step 3: Implement** — in `src/ducks/balances.ts`:

  - Add to `interface BalancesState`: `fetchedPublicKey: string | null;`
  - Add to the store's initial state: `fetchedPublicKey: null,`
  - In `fetchAccountBalances`, in the
    `set({ balances, isFunded, subentryCount })` call after a successful fetch,
    add `fetchedPublicKey: params.publicKey`.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** —
      `feat(balances): record fetchedPublicKey for the active-account funded signal`

---

## Task M4: reshape `buildCommonContext` (four buckets)

**Files:** Modify `core.ts`; Test `core.test.ts` **Interfaces:** Consumes
`getAccountIdHash` (M1), `getSurface` (M2), `fetchedPublicKey` (M3). Produces
exported `buildCommonContext(): Record<string,unknown>`.

**Verify at impl:** confirm `ActiveAccount` exposes `publicKey` (it does — used
today) and `importedFromSecretKey`; if the active `account` object lacks
`importedFromSecretKey`, derive `account_type` from
`allAccounts.find(a => a.publicKey === activePublicKey)?.importedFromSecretKey`.

- [ ] **Step 1: Failing tests** — add to `core.test.ts`:

```ts
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { buildCommonContext } from "services/analytics/core";

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
});
```

- [ ] **Step 2: Run** → FAIL (shape mismatch / not exported).

- [ ] **Step 3: Implement** — replace `buildCommonContext` in `core.ts`:

```ts
export const SCHEMA_VERSION = "2";

/**
 * Event-level volatile bucket + schema_version. Durable traits live in Identify;
 * device/app metadata comes from the RN SDK; connectivity is on app.opened.
 */
export const buildCommonContext = (): Record<string, unknown> => {
  const { network, account, allAccounts } = useAuthenticationStore.getState();
  const activePublicKey = account?.publicKey;

  const context: Record<string, unknown> = {
    schema_version: SCHEMA_VERSION,
    surface: getSurface(),
    network: network.toUpperCase(),
  };

  if (activePublicKey) {
    const idHash = getAccountIdHash(activePublicKey);
    if (idHash) context.account_id_hash = idHash;

    const isImported =
      account?.importedFromSecretKey ??
      allAccounts.find((a) => a.publicKey === activePublicKey)
        ?.importedFromSecretKey ??
      false;
    context.account_type = isImported ? "imported_secret_key" : "freighter";

    const { isFunded, fetchedPublicKey } = useBalancesStore.getState();
    if (fetchedPublicKey === activePublicKey) {
      context.account_funded = isFunded;
    }
  }

  return context;
};
```

Add `import { useBalancesStore } from "ducks/balances";`. Remove now-unused
imports if any (`truncateAddress`, `getVersion`, `getBuildNumber`, `getBundleId`
may still be used by trackAppOpened/Identify — keep those actually used; remove
`truncateAddress` if buildCommonContext was its only user — verify with grep).

- [ ] **Step 3b: Dead-import check** —
      `grep -n "truncateAddress\|getBuildNumber\|Platform.Version" src/services/analytics/core.ts`;
      remove imports with no remaining references.

- [ ] **Step 4: Run** → PASS (4 tests).

- [ ] **Step 5: Commit** —
      `refactor(analytics): reshape common context into RFC four-bucket model`

---

## Task M5: Identify traits (consent-gated) + auth-store subscription

**Files:** Modify `core.ts`; Test `core.test.ts` **Interfaces:** Produces
`deriveIdentifyTraits(allAccounts)`, `syncIdentifyTraits(allAccounts)`.

- [ ] **Step 1: Failing tests** — add to `core.test.ts`:

```ts
import { deriveIdentifyTraits } from "services/analytics/core";

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
});
```

(Consent-gating regression — mirror the extension: a call while
`isEnabled=false` must not send Identify or cache; after enabling, the same
traits send. Use `jest.isolateModules` + toggling the
`useAnalyticsStore.getState` mock, asserting `amplitude.identify`.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — in `core.ts`, replace `setAmplitudeUserProperties`
      usage with trait-syncing:

```ts
export const deriveIdentifyTraits = (
  allAccounts: { importedFromSecretKey?: boolean }[],
) => ({
  wallet_count: allAccounts.length,
  has_imported_account: allAccounts.some((a) => a.importedFromSecretKey),
});

let lastIdentifiedTraits: string | null = null;

export const syncIdentifyTraits = (
  allAccounts: { importedFromSecretKey?: boolean }[],
): void => {
  const traits = deriveIdentifyTraits(allAccounts);
  const fingerprint = JSON.stringify(traits);
  if (fingerprint === lastIdentifiedTraits) return;
  if (!AMPLITUDE_API_KEY || !hasInitialised) return;
  // Consent gate: don't cache unless the Identify can actually be sent, so
  // traits re-sync after consent hydrates (mirrors extension).
  if (!useAnalyticsStore.getState().isEnabled) return;
  lastIdentifiedTraits = fingerprint;

  const identify = new amplitude.Identify();
  identify.set(ANALYTICS_CONFIG.BUNDLE_ID_KEY, getBundleId());
  identify.set("wallet_count", traits.wallet_count);
  identify.set("has_imported_account", traits.has_imported_account);
  amplitude.identify(identify);
};
```

- In `initAnalytics`, replace the `setAmplitudeUserProperties();` call with
  `syncIdentifyTraits(useAuthenticationStore.getState().allAccounts);` (and
  delete the old `setAmplitudeUserProperties` function, which only set
  bundle_id). Add `import { useAuthenticationStore } from "ducks/auth";` if not
  already present.
- Add an auth-store subscription (near the existing analytics-store subscription
  at the bottom of the file):

```ts
useAuthenticationStore.subscribe((state) => {
  syncIdentifyTraits(state.allAccounts);
});
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** —
      `feat(analytics): send durable wallet traits via Identify (consent-gated)`

---

## Task M6: enrich `app.opened` snapshot

**Files:** Modify `core.ts`; Test `core.test.ts` **Interfaces:**
`trackAppOpened(props?)` now attaches the one-time snapshot.

- [ ] **Step 1: Failing test** — assert
      `trackAppOpened({previousState:"background"})` results in an
      `amplitude.track("event: App Opened", ...)` call whose payload includes
      `connection_type`, `effective_type`, `surface`, and (via common context)
      `schema_version`. (Set `hasInitialised` true via `initAnalytics`,
      `isEnabled` true; use `AnalyticsEvent.APP_OPENED`.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — replace `trackAppOpened`:

```ts
export const trackAppOpened = (props?: { previousState: string }): void => {
  const { connectionType, effectiveType } = useNetworkStore.getState();
  track(AnalyticsEvent.APP_OPENED, {
    ...props,
    surface: getSurface(),
    connection_type: connectionType ?? "unknown",
    ...(effectiveType ? { effective_type: effectiveType } : {}),
  });
};
```

(`network`, `schema_version`, and account fields arrive via `buildCommonContext`
inside `dispatchUnthrottled`.) No change needed at the
`useAnalyticsPermissions.ts` call sites.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Full-file test + typecheck**:
      `yarn jest src/services/analytics/core.test.ts` (all pass);
      `yarn tsc --noEmit` (or repo's type-check) clean.

- [ ] **Step 6: Commit** —
      `feat(analytics): enrich app.opened with one-time connectivity snapshot`

---

## Task M7: privacy guard test

**Files:** Test `core.test.ts`

- [ ] **Step 1** — add a guard test: with an active account,
      `buildCommonContext()` serialized contains no raw/truncated public key and
      no `publicKey` property. Run → PASS (behavior from M4).
- [ ] **Step 2: Commit** —
      `test(analytics): guard against raw public keys in payloads`

---

## Task X1: extension #2903 follow-up — `account_funded` from balances

**Repo:** `/Users/piyal/Stellar/freighter` — branch
`feat/analytics-schema-foundation-spec` (PR #2903). **Files:** Modify
`extension/src/helpers/metrics.ts`; `extension/src/helpers/metrics.test.ts`.

- [ ] **Step 1: Failing test** — in `metrics.test.ts`, mock `balancesSelector`
      from `popup/ducks/cache` to return `{ [PK]: { isFunded: true } }`; assert
      `buildCommonContext` emits `account_funded: true` from the balances cache
      (not the sticky flag), and omits `account_funded` when there's no cached
      entry for the active key.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — in `buildCommonContext`, replace the sticky
      `accountFundedByType[...]` derivation with a read from the balances cache:
      `const cached = balancesSelector(state)[activePublicKey]; if (cached) context.account_funded = cached.isFunded;`
      (omit when no cached entry). Add the `balancesSelector` import from
      `popup/ducks/cache`. Leave the `freighterAccountFunded` milestone event
      and `storeBalanceMetricData` intact (they still power that one-time
      event); only `account_funded`'s source changes.

- [ ] **Step 4: Run** — `yarn jest extension/src/helpers/metrics.test.ts` (all
      pass) + tsc clean.

- [ ] **Step 5: Commit + push** —
      `fix(analytics): derive account_funded from balances, not the sticky flag`
      → push (updates PR #2903).

---

## Task X2: RFC #23 note — pin the `account_funded` contract

**Repo:** `/Users/piyal/Stellar/wallet-eng-monorepo` — branch
`piyal/analytics-rfc-addendum` (PR #23). **Files:** Modify
`analytics-refactor-report.md`.

- [ ] **Step 1** — amend the `account_funded` row (Part 3 core properties) to:
      "Active-account funded state derived from the account's live/cached
      balance; omitted when the balance is not yet loaded for the active
      account. Not a sticky per-type flag." Commit + push (updates PR #23). No
      test.

---

## Verification (end of plan)

- [ ] `yarn jest src/services/analytics/core.test.ts` (mobile) — all pass;
      typecheck clean.
- [ ] Extension `metrics.test.ts` still green after X1.
- [ ] Manual (mobile): with analytics enabled on a funded testnet account,
      confirm events carry `schema_version:"2"`, `surface:"mobile_ios/android"`,
      `network`, `account_id_hash`, `account_type`, `account_funded`; never
      `platform`/`publicKey`/`is_hardware_account`; `app.opened` carries the
      connectivity snapshot; Identify shows
      `wallet_count`/`has_imported_account` (no `has_hardware_wallet`).

## Open items

- [ ] Confirm which of `platform`/`os`/`app_version` the RN SDK auto-attaches;
      if `app_version` is missing, pass it in `amplitude.init`.
- [ ] Confirm `ActiveAccount` exposes `importedFromSecretKey` (else derive
      `account_type` from `allAccounts`).
- [ ] Mobile `account_id_hash` reproduces the committed vector (shared with
      extension).
