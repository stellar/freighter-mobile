# Mobile Analytics Property-Model Foundation (Design Spec)

**Status:** Approved design, pre-implementation. **Local working artifact — not
committed** (the canonical schema lives in the RFC; product repos carry code,
not process docs). **Date:** 2026-07-14 **Owner:** piyal **Canonical schema
(RFC):** stellar/wallet-eng-monorepo#10 (+ addendum PR #23) **Extension
counterpart (shipped):** stellar/freighter#2903 **Identity primitive
(dependency, separate):** mobile `#864` (auth-keypair derivation; companion to
extension #2876)

---

## 1. Context

The mobile side of the cross-platform Amplitude refactor. Mirrors the extension
property-model foundation (#2903): align mobile's Amplitude property model to
the RFC four-bucket schema **without renaming events**.
`freighter-mobile/src/services/analytics/core.ts` is a near-1:1 analog of the
extension's `metrics.ts` — same over-chatty `buildCommonContext`, same opt-out
store subscription, `app.opened` + Experiment client already present. Evolve it
in place (no rewrite).

Mobile uses the **same single-mnemonic HD model** as the extension (flat
`Account = { id, name, publicKey, importedFromSecretKey? }`, one recovery
phrase, no per-seed-phrase grouping; "wallets" in the UI = accounts). It has
**no hardware wallets** and **no sticky funding model**.

## 2. Scope

**In scope** (global property-model changes in `core.ts`):

1. `schema_version: "2"` on every event.
2. `account_id_hash` (SHA-256 hex of the full G-address, memoized) replacing the
   truncated `publicKey`.
3. Drop hand-sent SDK-supplied fields (`platform`, `platformVersion`,
   `appVersion`, `buildVersion`, `bundleId`); rely on the RN SDK's built-in
   enrichment.
4. Durable traits → Amplitude Identify; volatile context stays event-level.
5. `getSurface()` (`mobile_ios`/`mobile_android`) + enrich `app.opened` with the
   one-time snapshot.

**Out of scope:** event renames (deferred to mobile's later slices);
identity/`user_id` (owned by #864).

**Cross-platform touch-points carried by this effort** (from the
`account_funded` decision):

- **Extension follow-up** — a commit on PR #2903 swapping `account_funded` from
  the sticky `metricsData` flag to the balances selector.
- **RFC addendum** — a note on PR #23 pinning the `account_funded` contract.

## 3. Key decisions

| Decision          | Choice                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration         | Hard cutover, no dual-write (per RFC addendum). Names stay legacy this slice.                                                                                         |
| `account_id_hash` | `hash(Buffer.from(publicKey,"utf8")).toString("hex")` (stellar-sdk), memoized. Must match the committed vector `G…AWHF → f56f6f2c…44ef`.                              |
| `surface`         | `mobile_ios` / `mobile_android` from `Platform.OS` (synchronous).                                                                                                     |
| `account_funded`  | Derived from the active account's **cached balance** (`useBalancesStore.getState().isFunded`); tri-state — **omit when balance not yet loaded**. Never a sticky flag. |
| `account_type`    | `freighter` \| `imported_secret_key` (from `importedFromSecretKey`); emitted only with an active account.                                                             |
| Hardware wallet   | **Omit both** `is_hardware_account` (event) and `has_hardware_wallet` (Identify) — mobile has no hardware-wallet concept.                                             |
| `wallet_count`    | `allAccounts.length` (consistent with extension).                                                                                                                     |
| Identity          | Out of scope; `user_id` stays as-is (owned by #864).                                                                                                                  |

## 4. The four buckets (`buildCommonContext`)

**Bucket 1 — SDK-supplied (stop hand-sending):** delete `platform`,
`platformVersion`, `appVersion`, `buildVersion`, `bundleId`. Rely on the
`@amplitude/analytics-react-native` context enrichment; pass `appVersion` in
`amplitude.init` if the RN SDK doesn't attach it automatically (confirm at
impl). Do **not** enable behavioral autocapture.

**Bucket 2 — event-level volatile:** `network` (kept), `surface` (new,
`getSurface()`), `schema_version: "2"`, and — only with an active account —
`account_id_hash`, `account_type`, `account_funded` (omit when balance unknown).
**No** `is_hardware_account`. **Removed:** `publicKey`, `connectionType`,
`effectiveType`.

**Bucket 3 — Identify user traits** (see §5).

**Bucket 4 — one-time `app.opened` snapshot** (see §6): `surface`, `network`,
`connection_type`, `effective_type`, `schema_version`.

## 5. Identity traits

Extend `setAmplitudeUserProperties`:

- `bundle_id` (existing), `wallet_count` = `allAccounts.length`,
  `has_imported_account` = any account `importedFromSecretKey`.
- **Omit** `has_hardware_wallet`.
- Dirty-checked (only when a trait changes) **and consent-gated** — do not cache
  the fingerprint unless `isEnabled` (mirrors the extension fix so traits
  re-sync after consent hydrates).
- Re-sync (`syncIdentifyTraits`) when the account list changes — wire to the
  auth store (`allAccounts`).

## 6. `app.opened`

Enrich the existing foreground-triggered `trackAppOpened` (legacy name
`"event: App Opened"` — unchanged) with the snapshot: `surface`, `network`,
`connection_type`, `effective_type`, `schema_version` (keep `previousState`).
Move `connection_type`/`effective_type` off `buildCommonContext` onto this
event. Fires on foreground (post store-hydration), so no init-timing consent
bug.

## 7. `account_id_hash`

`getAccountIdHash(publicKey)` — synchronous SHA-256 hex of the full G-address
via stellar-sdk `hash`, memoized per key; omit when no active key.
Cross-platform contract: identical to extension (committed vector). Never emit a
raw/truncated key.

## 8. Error handling & edge cases

- Pre-unlock / no active key → omit `account_id_hash`, `account_type`,
  `account_funded`.
- Balance not loaded → omit `account_funded` (not `false`).
- Consent off → no `track`, no `identify`, no fingerprint cache.
- Missing API key / not initialized → existing guarded no-op path preserved.
- Keep the existing throttle/dedupe dispatcher.

## 9. Testing

Mirror the extension's `metrics.test.ts`:

- `buildCommonContext` drops SDK/legacy fields; emits `schema_version`,
  `surface`, `network`, and (with active key)
  `account_id_hash`/`account_type`/`account_funded`; never
  `is_hardware_account`, `has_hardware_wallet`, `publicKey`.
- `account_id_hash` matches the committed cross-platform vector.
- `account_funded` omitted when balance unknown; true/false when loaded.
- Identify emits `wallet_count`/`has_imported_account`/`bundle_id`, not
  `has_hardware_wallet`; consent-gated (no send/cache while opted out; re-sync
  after opt-in).
- `app.opened` carries the snapshot; connectivity fields absent from other
  events.
- Privacy guard: no raw/truncated public key in any payload.

## 10. Open items to confirm

- Which of `platform`/`os`/`app_version` the RN SDK auto-attaches (drop vs pass
  in `init`) — resolve at impl.
- Mobile reproduces the `account_id_hash` vector (shared with extension).
