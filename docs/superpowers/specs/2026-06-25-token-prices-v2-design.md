# Token Prices v2 Migration — Design

**Date:** 2026-06-25 **Branch:** feat/token-prices-v2 **Reference:**
[stellar/freighter#2870](https://github.com/stellar/freighter/pull/2870)

## Goal

Migrate `fetchTokenPrices` from the v1 backend endpoint to the network-scoped v2
endpoint, gated behind a `use_token_prices_v2` remote-config flag so the rollout
can be reverted from Amplitude without shipping a release. This ports the
extension PR above to freighter-mobile.

## Background

Today `fetchTokenPrices` (`src/services/backend.ts`) POSTs to
`freighterBackendV1` `/token-prices` with `{ tokens }`. A `freighterBackendV2`
client already exists (`src/services/backend.ts`, configured from
`BackendEnvConfig.FREIGHTER_BACKEND_V2_URL`).

The v2 `/token-prices` endpoint is **network-scoped**: callers must pass the
active network as a `network` query param (`PUBLIC` or `TESTNET`). Networks the
endpoint does not serve prices for (Futurenet) must be skipped client-side to
avoid guaranteed-failing requests and the resulting Sentry noise.

Mobile's `NETWORKS` enum values are already the literal strings `"PUBLIC"`,
`"TESTNET"`, `"FUTURENET"` (`src/config/constants.ts`), so no passphrase-to-name
mapping is required — unlike the extension, which maps from `networkPassphrase`.

Mobile has a remote-config / feature-flag system (`src/ducks/remoteConfig.ts`,
backed by Amplitude Experiment), so the extension's `use_token_prices_v2` flag
is directly portable.

## Design

### 1. Feature flag — `src/ducks/remoteConfig.ts`

- Add `"use_token_prices_v2"` to the `BOOLEAN_FLAGS` tuple. The
  `BooleanFeatureFlags` type derives from this array automatically.
- Add `use_token_prices_v2: true` to **both** branches of
  `INITIAL_REMOTE_CONFIG_STATE` (the `isDev || __DEV__` branch and the prod
  branch). v2 is the default; Amplitude can flip it to `false` to fall back to
  v1 without a release.

### 2. Service — `src/services/backend.ts` `fetchTokenPrices`

Extend `FetchTokenPricesParams`:

```ts
export interface FetchTokenPricesParams {
  tokens: TokenIdentifier[];
  network: NETWORKS;
  useV2: boolean;
}
```

Behavior:

- Keep the existing LP-share / custom-token filtering (`filteredTokens`).
- If `filteredTokens` is empty, short-circuit: return a null-filled map for the
  requested `tokens` (no request) — matches the PR's "skip if all tokens filter
  out".
- **v2 path** (`useV2 === true`):
  - Map network to the price-network query value: `NETWORKS.PUBLIC → "PUBLIC"`,
    `NETWORKS.TESTNET → "TESTNET"`.
  - Unsupported network (anything else, i.e. Futurenet): **short-circuit** to
    the null-filled map, no request.
  - Otherwise:
    `freighterBackendV2.post<TokenPricesResponse>("/token-prices", { tokens: filteredTokens }, { params: { network } })`.
    Axios serializes `params` into the `?network=` query string.
- **v1 path** (`useV2 === false`): unchanged — `freighterBackendV1.post(...)`
  with no network param.
- Response post-processing (null-fill missing tokens, `bigize`) is unchanged and
  shared across both paths.

The null-filled map (used by both short-circuits) reuses the existing contract:
every requested token maps to
`{ currentPrice: null, percentagePriceChange24h: null }`, then `bigize`d for
return-type consistency.

### 3. Store — `src/ducks/prices.ts`

The flag is read in the duck layer (not the service), keeping `services/` free
of `ducks/` imports and mirroring the PR's hook-reads-flag structure.

- Import `useRemoteConfigStore`. Read
  `useRemoteConfigStore.getState().use_token_prices_v2` once per fetch call.
- `fetchPricesForBalances`: already receives `network` (currently destructured
  away / unused) — forward `network` and `useV2` to `fetchTokenPrices`.
- `fetchPricesForTokenIds`: add a required `network: NETWORKS` param to its
  params object; forward `network` and `useV2` to `fetchTokenPrices`.

### 4. Callers — thread network in

- `src/components/screens/SwapScreen/hooks/useSwapTokenPrices.ts`: read the
  active network from `useAuthenticationStore` and pass it to both
  `fetchPricesForTokenIds` calls (the effect fetch and `refreshPrices`).
- `src/hooks/blockaid/useTransactionBalanceListItems.tsx`: read
  `useAuthenticationStore.getState().network` inside the memo (it already uses
  `usePricesStore.getState()` there) and pass it to `fetchPricesForTokenIds`.
- `src/ducks/balances.ts`: no change — it already passes `network` to
  `fetchPricesForBalances`.

### 5. Tests

- `__tests__/ducks/prices.test.ts`: mock `useRemoteConfigStore`; update
  `fetchTokenPrices` call assertions to include `network` and `useV2`; pass
  `network` into `fetchPricesForTokenIds` calls.
- Add coverage for `fetchTokenPrices` itself:
  - v2 on + supported network → POSTs to v2 client with the `network` query
    param.
  - flag off → POSTs to v1 client, no network param.
  - v2 on + Futurenet → returns the empty/null-filled map with **no** request.

## Non-goals

- **Per-network cache keying.** The extension caches prices keyed by
  `[networkPassphrase][publicKey]`. Mobile's prices store is a flat in-memory
  `TokenPricesMap` keyed by token identifier, refreshed on balance and network
  changes rather than a persistent per-account cache. Network-keyed caching is a
  separable enhancement, not required by the endpoint migration. Minor
  consequence: after a network switch, a token identifier's previously fetched
  price can briefly persist in the merged map until the next fetch overwrites it
  — pre-existing behavior, unchanged by this work.
