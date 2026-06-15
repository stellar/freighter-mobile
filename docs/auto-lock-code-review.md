# Auto-Lock Timer — Consolidated Code Review

> Scope: all staged changes for the Auto-Lock Timer feature (issue #627), the
> soft-lock overlay, and the lock-screen biometric auto-prompt. Method: two
> independent reviews in isolated contexts — a **Security** review (application
> security engineer perspective) and a **Senior Developer** review (architecture
> / correctness / tests) — merged and deduplicated below. Attribution noted per
> finding.

**Verdict (combined): NOT ready to merge.** Core design and happy paths are
solid and tested, but the sliding hash-key TTL regression, the
lock-policy-in-plain-storage tampering path, native modals rendering above the
overlay, and the navigation-reset race must be addressed first.

## Resolution status (updated after fixes)

| Finding                      | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 sliding TTL               | ✅ **Fixed** — the foreground-return refresh was removed from `getAuthStatus`; `expiresAt` is now anchored ONLY at credential-verified moments (`signIn`, `generateHashKey`, `applyAutoLockTimerToHashKey` on in-app setting change). "None" keeps its never-expire TTL because it is also set only at those moments. Pinned by tests: "consume the timestamp WITHOUT refreshing the hash key TTL" and "HASH_KEY_EXPIRED even if within the timer".                                                                                               |
| C2 plain-storage tampering   | ✅ **Fixed** — the timer setting and backgrounded-at timestamp moved to `SENSITIVE_STORAGE_KEYS`/`secureDataStorage`; future-dated timestamps rejected and cleaned up (+ tests). Combined with the C1 fix, AsyncStorage tampering can no longer weaken the lock or the key TTL.                                                                                                                                                                                                                                                                   |
| C3 modals above overlay      | ⚠️ **Accepted (product decision)** — a native-Modal-hosted overlay was implemented and reverted for visual/UX reasons. Residual risk: an RN `Modal` open at lock time stays visible/tappable above the overlay; mitigations in place: sensitive reads are gated while LOCKED (getActiveAccount, WalletKit), `account` is cleared on soft lock. Re-evaluate if a styling-acceptable native hosting is found.                                                                                                                                       |
| I1 navigation-reset race     | ✅ Fixed — store `getAuthStatus` is the single funnel: every caller (checkAuth, fetchActiveAccount, selectAccount) produces the same atomic soft lock; manual `set`/`navigateToLockScreen` calls removed from those callers                                                                                                                                                                                                                                                                                                                       |
| I2 non-atomic transition     | ✅ Fixed — `softLock` sets `authStatus` + `isSoftLocked` (+ `account: null`) in ONE `set()`; pinned by a store-subscription test asserting `LOCKED && !isSoftLocked` is never observable                                                                                                                                                                                                                                                                                                                                                          |
| I3 Android back button       | ✅ Fixed — `BackHandler` listener returns `true` while soft-locked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| I4 in-memory secrets / JSDoc | ✅ Fixed — `softLock` clears `account` (private key) atomically; JSDoc corrected to name the real protections. `derivedKeyCache` intentionally kept (documented PR #664 fast-unlock design). `getTemporaryStore` LOCKED-allowance retained — required by the unlock path itself — now noted here as the invariant.                                                                                                                                                                                                                                |
| I5 fire-and-forget persist   | ✅ Fixed — `softLock` is async and awaits the secure-storage `LOCKED` write                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| I6 snapshot/accessibility    | ⚠️ **Deferred to follow-up** — `accessibilityViewIsModal` confines screen-reader focus to the overlay. App-switcher snapshot privacy must be handled natively (the only place it works, matching MetaMask/Rainbow/Coinbase): **iOS** AppDelegate splash overlay on `applicationWillResignActive`/`applicationDidBecomeActive`; **Android** `FLAG_SECURE` on the activity. A JS curtain was tried and removed (can't beat the OS snapshot, flashed on return). Native implementation is intentionally **not in this PR** — tracked as a follow-up. |
| I7 nulled navigationRef      | ✅ Fixed — `signIn`/`signUp`/`importWallet` preserve `navigationRef` through the `initialState` spread                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| I8 missing tests             | ✅ Mostly fixed — new `useAuthCheck` suite (background-only recording, IMMEDIATELY soft lock, funnel delegation), funnel atomicity test, corrupt + future-dated timestamp tests, softLock account-clearing assertion. Remaining gap: no render test for RootNavigator's `showAuthenticatedStack` conditional.                                                                                                                                                                                                                                     |
| M1 NaN cleanup               | ✅ Fixed — `getBackgroundedAt` clears corrupt values and returns null (+ test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| M2 mirror drift              | ✅ Fixed — setter reverts UI state if the mirror write fails (+ test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| M3 wall-clock                | ✅ Documented in `getAuthStatus` (accepted limitation; bounded by the hash-key expiry)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| M4 OEM biometric AppState    | ✅ Documented in `useAuthCheck`; remains a device-QA item (test plan §8.4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| M5 rehydration window        | ✅ Fixed — IMMEDIATELY check reads the dataStorage mirror, not zustand state                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| M6 overlay subscription      | ✅ Fixed — narrow `isSoftLocked` selector                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| M7 re-prompt fatigue         | ✅ Documented as intentional banking-app behavior (explicit product request)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| M8 timer survives wipe       | ✅ Fixed — full wipe resets the preference to the 24h default via the setter (store + mirror)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## Strengths (both reviewers)

- Locked-state key access properly gated at the data layer: `getActiveAccount`
  hard-blocks `LOCKED` (`src/ducks/auth.ts:1714-1724`); WalletKit session
  proposals/requests reject while `LOCKED`/`HASH_KEY_EXPIRED`
  (`src/providers/WalletKitProvider.tsx:853-864, 946-958`).
- The locked state itself is tamper-resistant: persisted `AUTH_STATUS.LOCKED`
  lives in secure storage and is checked first in `getAuthStatus` — AsyncStorage
  tampering cannot _un-lock_ a locked session.
- Evaluation ordering is correct (persisted-LOCKED → timer → hash-key expiry);
  the consume-only-when-`active` guard correctly survives Android's 60s
  background check interval.
- Fail-safe preference parsing: corrupt/missing timer values degrade to the 24h
  default (more locking, never less).
- The biometric auto-prompt refactor removes the cold-start double prompt by
  deleting the dual-owner `useAppOpenBiometricsLogin`; the guard ordering in
  `LockScreenContent` correctly handles async `signInMethod` resolution.
- Conventions respected: enums, no magic numbers, EN+PT translations, house
  JSDoc style, ESLint clean; tests are largely behavioral and all pass.
- Bottom sheets are correctly covered by the overlay (rendered after
  `BottomSheetModalProvider`); `Keyboard.dismiss()` on lock; signIn clears stale
  timestamps.

---

## Critical (must fix)

### C1. Sliding hash-key TTL makes key-material lifetime unbounded without re-authentication — _Security (Critical) + Senior (Minor 7, same root)_

`src/ducks/auth.ts:524-537`

The old model anchored `expiresAt` only at credential-verified moments
(`generateHashKey`, `signIn`), guaranteeing the hash key — and the temporary
store it decrypts (mnemonic, private keys, **plaintext password**, see
`auth.ts:2021`) — was dead ≤ 24h after the last password/biometric entry. The
new code rewrites `expiresAt = now + 24h` (or +100 years for NONE) inside
`getAuthStatus` on every foreground return, **with zero proof of user
presence**.

- **Attack**: a thief holding a phone inside its auto-lock window reopens the
  app once per timer period; the wallet never hard-expires and never demands the
  password again, indefinitely. Previously bounded at 24h.
- This regresses **every** setting, including the default 24h that the PR claims
  is "no behavior change" — today's behavior is a fixed cryptoperiod, not a
  sliding one. Key rotation (previously forced by each full re-auth) also never
  happens.
- **Fix**: refresh `expiresAt` only after successful credential verification
  (keep it in `signIn`/`generateHashKey` only). For NONE, disable the _timer_
  but keep a bounded hash-key expiry — the fast-unlock LOCKED path already makes
  the periodic re-auth cheap. If product insists NONE never re-prompts, that
  trade-off must not leak into the other seven options via the unconditional
  slide.

### C2. Lock policy driven by unencrypted AsyncStorage; tampering it extends the _keychain_ TTL — _Security (Important #2, escalated by C1 interaction)_

`src/services/autoLock.ts:22-34, 79-101`; `src/ducks/auth.ts:505-537`;
`src/hooks/useAuthCheck.ts:128-134`

`AUTO_LOCK_TIMER_SETTING`, `AUTO_LOCK_BACKGROUNDED_AT`, and the zustand
`preferences-storage` mirror (which gates IMMEDIATELY) all live in plain
AsyncStorage. An attacker with sandbox write access (rooted Android, backup
modify-and-restore, forensic tooling) can:

- delete/garbage/future-date `backgroundedAt` (`Number(garbage)` → `NaN`
  silently disables the comparison), or
- set the timer to `"none"`, after which the app _itself_ rewrites the keychain
  hash key to `now + 100 years` on next foreground (`auth.ts:530-536`).

This contradicts the codebase's own documented threat model ("Read from SECURE
storage (encrypted) to prevent tampering", `auth.ts:484`; "prevents tampering
via ADB or rooted devices", `auth.ts:2076`) — `AUTH_STATUS` was deliberately
moved to secure storage against exactly this attacker.

- **Fix**: store the timer preference and timestamps in `secureDataStorage`
  (tiny, low-frequency values); reject future-dated timestamps; treat
  missing-timestamp-with-present-hash-key conservatively. Fixing C1 removes the
  TTL-extension half.

### C3. Native `Modal`s render **above** the soft-lock overlay and stay interactive while locked — _Security (Important #3)_

`src/components/Modal.tsx:32-41` vs `src/components/App.tsx:85-91`

RN `Modal` hosts content in a separate native window that z-orders above every
in-root view, including `LockScreenOverlay` (a plain sibling `View`). If a modal
is open when the lock fires (e.g. IMMEDIATELY while `RenameAccountModal` /
`ConfirmationModal` / `PermissionModal` is up), on return it is fully visible
and **tappable on top of the lock** — content leaks and its actions execute
against the mounted authenticated tree without re-auth.

- **Fix**: render the lock overlay in a top-level native `Modal` (with no-op
  `onRequestClose`), or dismiss/gate all RN modals on `softLock`
  (`!isSoftLocked`).

---

## Important (should fix)

### I1. Other `getAuthStatus` callers hard-reset navigation when the timer fires, racing the soft lock — _Senior (#1)_

`src/ducks/auth.ts:2714-2723` (`fetchActiveAccount`), `2836-2841`
(`selectAccount`)

Only `useAuthCheck.checkAuth` routes timer-`LOCKED` to `softLock()`. If
`fetchActiveAccount` runs first on a foreground return after expiry, it sets
`LOCKED` + `navigateToLockScreen()` while `isSoftLocked` is still `false` →
`resetRoot` wipes the tree, defeating the feature's central guarantee (and can
then fight `checkAuth`'s later `softLock()`).

- **Fix**: centralize the AUTHENTICATED→LOCKED transition (e.g. in the store
  `getAuthStatus` action, the single funnel) so every caller produces a soft
  lock; also fixes I2.

### I2. `authStatus: LOCKED` and `isSoftLocked: true` are set in separate, non-atomic updates — _Senior (#2)_

`src/ducks/auth.ts:2650` + `src/hooks/useAuthCheck.ts:61-66`

Today React batches them; any future `await` inserted between silently unmounts
the whole authenticated group (`RootNavigator` sees `LOCKED && !isSoftLocked`).
The no-unmount guarantee should not rest on scheduler timing.

- **Fix**: one atomic `set()` for the lock transition (naturally falls out of
  the I1 centralization).

### I3. Android hardware back button is not intercepted by the overlay — _Senior (#3)_

`src/components/LockScreenOverlay.tsx:31-36`

The overlay swallows touches but hardware back events reach the navigation
container underneath — while "locked", back presses pop screens in the hidden
tree (mutating the state being preserved) or exit the app.

- **Fix**: `BackHandler` listener returning `true` while `isSoftLocked` (or the
  native-Modal approach from C3, which solves both).

### I4. In-memory secrets survive the soft lock; JSDoc overstates the protection — _Security (#6, #7) + Senior (#4), merged_

`src/ducks/auth.ts:2158-2174` (softLock), `619-636` (getTemporaryStore),
`account.privateKey` in store

- `softLock()` leaves `account` (including `privateKey`, signing-capable via
  `useGetActiveAccount.signTransaction`) in the zustand store, and the
  `derivedKeyCache` warm — unlike `logout`'s soft path which clears `account`.
- `getTemporaryStore` explicitly **allows** `LOCKED` ("preserved session that
  can be unlocked"), so any future caller running under the overlay could
  decrypt the mnemonic/password. Not currently exploitable (callers are
  authenticated-flow-only and WalletKit rejects while locked), but the invariant
  is undocumented and untested.
- `softLock`'s JSDoc claims "the temporary store denies access while authStatus
  is LOCKED" — **false**; the protection is the UI overlay plus
  `getActiveAccount`'s gate.
- **Fix**: clear `account: null` (signIn repopulates it anyway) and consider
  clearing `derivedKeyCache` for IMMEDIATELY; correct the JSDoc; add a test
  pinning "no secret-bearing path succeeds while LOCKED".

### I5. `softLock`'s secure-storage write is fire-and-forget — _Security (#5)_

`src/ducks/auth.ts:2158-2173`

In-memory lock state is set synchronously but the persisted `LOCKED` write is
`.catch(log)`. If the process is killed before the write lands (most likely
exactly on the IMMEDIATELY path — lock fires on backgrounding), a cold start
within the timer window returns `AUTHENTICATED`, silently bypassing a lock the
user already saw. `logout` awaits the same write.

- **Fix**: await the write (or rely on the already-persisted backgrounded-at
  timestamp by recording it before/synchronously with the lock so the timer path
  still catches the cold start).

### I6. No screenshot/snapshot/accessibility protection for the mounted tree — _Security (#4)_

No `FLAG_SECURE` (Android), no iOS privacy snapshot/blur anywhere in the
codebase. For timed options the wallet is showing real content at backgrounding
time, so the app-switcher card captures the **unlocked** screen; the live
hierarchy under the overlay also remains exposed to the accessibility
tree/screen readers (plain sibling `View`, no `accessibilityViewIsModal` /
`importantForAccessibility="no-hide-descendants"`).

- Pre-existing gap, but the "keep screens mounted" design makes it materially
  worse. **Fix**: privacy snapshot/FLAG_SECURE on background regardless of
  timer; hide the locked tree from accessibility.

### I7. Resumed screens see `account: null` (and `navigationRef: null`) right after a soft unlock — _Senior (#5)_

`src/ducks/auth.ts:2224-2229`

`signIn`'s `...initialState` spread nulls
`account`/`navigationRef`/`signInMethod` while the user resumes **mid-flow** in
screens that historically only mounted from a fresh stack. Until the background
`getActiveAccount` resolves, deep flows render their null path; `navigationRef`
stays null (nothing remounts to restore it), so later
`navigateToLockScreen`/`resetRoot` calls silently no-op.

- **Fix**: preserve `navigationRef` explicitly in `signIn` (pattern already
  exists in `logout`, `auth.ts:2095-2096`); QA resume-mid-send-flow with a slow
  account load.

### I8. Missing tests for the riskiest new logic — _both reviewers_

`useAuthCheck` (background-only recording, IMMEDIATELY soft-lock,
LOCKED→softLock dispatch) and `RootNavigator`'s `showAuthenticatedStack`
conditional are untested — I1/I2 regressions would not be caught today. Also
add: tamper tests (AsyncStorage edits can't unlock a persisted-LOCKED session),
"expiresAt does not advance without credential verification" (after C1), and
"open RN Modal not interactive while soft-locked" (after C3).

---

## Minor (nice to have)

| #   | Finding                                                                                                                                                                                                    | Source   | Location                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| M1  | `getBackgroundedAt` returns `NaN` for corrupt values — treated as absent (safe) but never cleaned up; return `null` on `Number.isNaN` and clear the key                                                    | Senior   | `src/services/autoLock.ts:96-101`         |
| M2  | Mirror drift on partial failure: UI checkmark and enforced mirror value can disagree if `persistAutoLockTimer` rejects (fire-and-forget)                                                                   | Senior   | `src/ducks/preferences.ts:39-58`          |
| M3  | Wall-clock timer: rolling the device clock back dodges auto-lock; likely accept-and-document (no easy monotonic source in RN)                                                                              | Senior   | timer evaluation                          |
| M4  | Some Android OEMs emit `background` (not `inactive`) when BiometricPrompt appears → with IMMEDIATELY, an in-app biometric confirmation could soft-lock mid-action / loop the re-prompt. Verify on hardware | Senior   | `useAuthCheck` + `LockScreen.tsx:191-206` |
| M5  | IMMEDIATELY before zustand rehydration completes reads the 24h default and skips the instant in-process lock; mirror still enforces on return (cosmetic)                                                   | Senior   | `src/hooks/useAuthCheck.ts:128`           |
| M6  | `LockScreenOverlay` subscribes to the whole auth store → re-renders on all auth churn; use `useAuthenticationStore((s) => s.isSoftLocked)`                                                                 | Senior   | `src/components/LockScreenOverlay.tsx:25` |
| M7  | Biometric re-prompt on every background→active return is a lock-fatigue nudge toward device-PIN fallback (`allowDeviceCredentials: true`); cosmetic                                                        | Security | `LockScreen.tsx:154-205`                  |
| M8  | `AUTO_LOCK_TIMER_SETTING` survives full wipe → the next wallet on the device inherits the previous user's (possibly attacker-set "none") preference; reset/re-validate on fresh sign-up                    | Security | `src/services/storage/helpers.ts:30-33`   |

---

## Consolidated recommendations

1. **Decouple "auto-lock timer" (UX) from "hash-key cryptoperiod" (security
   backstop)** — the conflation is the root of C1/C2. TTL anchored only at
   credential entry; timer inputs in secure storage.
2. **Centralize the AUTHENTICATED→LOCKED soft-lock transition** in the store
   `getAuthStatus` action (fixes I1+I2, removes module/action duplication).
3. **Harden the overlay**: native-Modal hosting or modal dismissal on lock (C3),
   BackHandler (I3), accessibility hiding + FLAG_SECURE/privacy snapshot (I6),
   `account: null` + JSDoc fix (I4).
4. **Await the `softLock` persist** (I5); preserve `navigationRef` through
   `signIn` (I7).
5. **Add the missing test coverage** (I8) and the tamper/secret-path invariant
   tests.
6. Device QA matrix: Android back button while overlaid; OEM biometric-prompt
   AppState behavior with IMMEDIATELY; resume-mid-send-flow with slow account
   load; iOS app-switcher snapshot content.
