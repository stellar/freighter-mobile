# Error Handling

## Zustand Action Pattern

Every async action in a Zustand store follows this error handling structure:

```tsx
fetchData: async (params) => {
  set({ isLoading: true, error: null });

  try {
    const result = await service.getData(params);
    set({ data: result, isLoading: false });
  } catch (error) {
    const normalized = normalizeError(error);
    set({ error: normalized.message, isLoading: false });
  }
},
```

Always clear the error state before starting a new request (`error: null`).

## Error Normalization

`normalizeError()` in `src/config/logger.ts` converts unknown errors into proper
`Error` objects for Sentry reporting. It handles:

- Standard `Error` objects (passed through)
- Plain strings (wrapped in `new Error()`)
- `null` / `undefined` (generic fallback message)
- React Native event objects (extracts meaningful info)
- Nested error objects (unwraps to find the root cause)

Use `logger.error()` to report errors — it normalizes and forwards to Sentry
internally. **Do not call `Sentry.captureException()` directly.**

```tsx
import { logger, normalizeError } from "config/logger";

try {
  await riskyOperation();
} catch (error) {
  const normalized = normalizeError(error);
  logger.error("featureName.riskyOperation", "Operation failed", error);
  set({ error: normalized.message, isLoading: false });
}
```

Note: `logger.error()` normalizes the error internally — the explicit
`normalizeError()` call here is only needed to extract the `.message` string for
store state. Do not call both unless you need the message string for a separate
purpose.

## Type Guards

Use runtime type guards to discriminate between balance shapes from the network:

- `isNativeBalance()` (in `src/services/transactionService.ts`) — checks if a
  balance is the native XLM asset
- `isLiquidityPool()` (in `src/helpers/balances.ts`) — checks if a balance
  represents a liquidity pool share

Add new type guards in the same files when you introduce new polymorphic data
shapes.

## Network Retry

Horizon transaction submissions retry on HTTP 504 with exponential backoff:

| Attempt | Delay            |
| ------- | ---------------- |
| 1       | 1 second, retry  |
| 2       | 2 seconds, retry |
| 3       | 4 seconds, retry |
| 4       | 8 seconds, retry |
| 5       | — (throws error) |

4 retries with exponential backoff (`attempt < SUBMIT_BACKOFF_MAX_ATTEMPTS`),
then the error is surfaced on attempt 5.

## Toast Notifications

Surface user-facing errors via the toast system. **Never use `Alert.alert()`**
in production app code — the app uses toasts and bottom sheets for all
user-facing messaging. Exception:
`src/components/analytics/DebugBottomSheet.tsx` uses `Alert.alert()` for a
dev-only cache reset confirmation; this is an intentional debug carve-out.

```tsx
// Correct - use toast for errors (variant + title are required)
const { showToast } = useToast();
showToast({ variant: "error", title: t("send.errors.insufficientBalance") });

// Wrong - never use Alert.alert() in app code
Alert.alert("Error", "Insufficient balance");
```

For confirmations (e.g., "Are you sure you want to delete this account?"), use a
bottom sheet, not a native alert.

**Stores set `error` state — components call `showToast`.** `useToast()` is a
React hook and cannot be called inside a Zustand store action. The correct
pattern is:

1. Store catch block:
   `set({ error: normalizeError(error).message, isLoading: false })`
2. Component: watch the `error` field and call `showToast` in a `useEffect` or
   event handler when it becomes non-null

```tsx
// In the store action (correct)
} catch (error) {
  const normalized = normalizeError(error);
  logger.error("store.fetchData", "Fetch failed", error);
  set({ error: normalized.message, isLoading: false });
}

// In the component (correct)
const error = useMyStore((state) => state.error);
const { showToast } = useToast();
useEffect(() => {
  if (error) {
    showToast({ variant: "error", title: error });
  }
}, [error, showToast]);
```

## Transaction Validation

`validateTransactionParams()` is used by the Send flow's `buildTransaction()` in
`src/services/transactionService.ts`. Call it before building any transaction.
It returns an error message string or `null`:

```tsx
const validationError = validateTransactionParams({
  destination,
  amount,
  asset,
});

if (validationError) {
  set({ error: validationError });
  return;
}

// Safe to build the transaction
```

## WalletConnect Error Responses

When rejecting a WalletConnect request, use the `rejectSessionRequest` helper
from `helpers/walletKitUtil` — it handles the `respondSessionRequest` call and
error shape internally:

```tsx
import { rejectSessionRequest } from "helpers/walletKitUtil";

await rejectSessionRequest({
  sessionRequest,
  message: "User rejected the request",
});
```

Use `hasRespondedRef` to prevent duplicate responses to the same request:

```tsx
if (hasRespondedRef.current) return;
hasRespondedRef.current = true;
await rejectSessionRequest({ sessionRequest, message });
```

## Logger severity

Each level has different Sentry behavior. Pick the one that matches the
failure's actionability — the goal is that **anything that reaches Sentry as a
top-level event is something an engineer should look at**.

| Level            | Sentry behavior                                                                                        | Use for                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `logger.error()` | Top-level Sentry issue (`captureException`). Counts against quota. Pages on alerts.                    | Real bugs and load-bearing failures that need engineering action.                                        |
| `logger.warn()`  | Sentry breadcrumb. Ships only attached to a real captured event. Zero quota cost.                      | Expected-but-noteworthy conditions that provide forensic context if something downstream goes wrong.     |
| `logger.info()`  | Dev-only console output. **No-op in production builds** (the production Sentry adapter discards them). | Routine operational signal useful for local dev. Also use to protect the breadcrumb buffer in hot loops. |
| `logger.debug()` | Dev-only console output. **No-op in production builds.**                                               | Verbose diagnostic during development.                                                                   |

### Choosing the level

Ask three questions in order:

1. **Is this a real bug or load-bearing failure?** → `error`. Examples: 5xx
   backend response, malformed payload, keychain write failure, feature-flag
   fetch failure when the device is online, systemic outage detected via an
   aggregate signal (e.g. every item in a batch fetch returned an error).
2. **Is this expected but worth keeping as forensic context if a downstream
   event captures?** → `warn`. Examples: connectivity failures (offline, DNS,
   TLS), 4xx Horizon protocol rejections, keychain read blocked because the app
   was backgrounded, pre-flight informational scan failure.
3. **Is this routine, high-volume, or only useful in local dev?** → `info` /
   `debug`. Examples: per-token failures inside a many-token loop (where one
   breadcrumb per token would blow the ~100/session buffer), hash-key TTL
   expiration, debug observations.

### Patterns established in this codebase

| Failure                                               | Level                                   | Why                                                                                                    |
| ----------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Connectivity (offline, DNS, TLS, captive portal)      | `warn`                                  | Self-resolves; not actionable. Branch on `isApiNetworkError` from `services/apiFactory`.               |
| Axios timeout (`ECONNABORTED`)                        | `error`                                 | Backend latency regression — carved out of `isApiNetworkError` so it stays visible.                    |
| Backend 5xx                                           | `error`                                 | Real outage.                                                                                           |
| Horizon 4xx protocol rejection                        | `warn`                                  | User-correctable (`tx_bad_seq`, `op_underfunded`). User toast + analytics handle the user-facing side. |
| Keychain WRITE / REMOVE / CLEAR                       | `error`                                 | Security-relevant; silent failure could leave stale credentials.                                       |
| Keychain READ blocked (`errSecInteractionNotAllowed`) | `warn`                                  | Expected when app is backgrounded or device is locked.                                                 |
| Per-item failure inside a hot loop                    | `info`                                  | Volume control — breadcrumb buffer cap is ~100/session.                                                |
| Per-collection failure (aggregate)                    | `warn` per-item + `error` when ALL fail | Surface systemic outage as one event; keep per-item context as breadcrumbs.                            |
| User-typo validation failure                          | `warn` at source                        | Not a bug; expected user input. Some are also filtered in `beforeSend`.                                |
| Auth state guard ("Attempted access in LOCKED state") | `warn`                                  | Recoverable; security-relevant signal but not actionable.                                              |
| Hash-key TTL expiration                               | `info`                                  | Expected lifecycle event.                                                                              |

### Logger anti-patterns

**Don't interpolate identifiers into the log message string.** PublicKeys,
WalletConnect topics, account IDs, etc. bypass `sanitizeLogData` (which only
walks object keys, not message text) and ship verbatim. Use structured args
instead so the sanitizer can redact PII fields:

```tsx
// Wrong: identifier embedded in message; bypasses redaction
logger.error("ctx", `Failed for publicKey ${publicKey}`, error);

// Right: identifier in structured args; publicKey is in PII_FIELDS_LOWER
logger.error("ctx", "Failed for account", error, { publicKey });
```

For values that aren't strict PII but shouldn't ship in full (WalletConnect
session topics, opaque correlation IDs), truncate inline:

```tsx
logger.error("ctx", `Failed. topic: ${topic.slice(0, 8)}...`, error);
```

**Don't pass a non-Error as the third arg to `logger.error()`.** That slot is
the captured-exception. A plain object like `{ count: 5 }` gets wrapped into a
generic Error whose message embeds the count value, fragmenting Sentry's issue
grouping into one issue per distinct value:

```tsx
// Wrong: { count } as captured exception → fragments by count
logger.error("ctx", "All collections failed", { count });

// Right: stable Error for grouping, structured context in args
logger.error(
  "ctx",
  "All collections failed",
  new Error("All collections failed"),
  { count },
);
```

**Don't double-log on a single failure.** A `logger.error` inside a `try`
followed by another `logger.error` in the surrounding `catch` produces two
Sentry events for one failure:

```tsx
// Wrong: 2 Sentry events for 1 bad payload
try {
  if (malformed) {
    logger.error("ctx", "Invalid response", data);
    throw new Error("Invalid response");
  }
} catch (err) {
  logger.error("ctx", "Failed", err); // ← duplicates the inner log
}

// Right: warn for inner context (breadcrumb only), error only in the catch
try {
  if (malformed) {
    logger.warn("ctx", "Invalid response", { data });
    throw new Error("Invalid response");
  }
} catch (err) {
  logger.error("ctx", "Failed", err);
}
```

**Don't wrap every catch in `logger.error`.** Many catches are routine lifecycle
(offline, biometric cancelled, hash key expired) — those want `warn` or `info`.
`error` is for failures that need engineering action.

## Rules

- **Avoid** silently swallowing errors (including empty catch blocks). Default
  to logging at the appropriate severity (see the table above) — `info` for
  routine lifecycle, `warn` for forensic context, `error` for failures that need
  engineering action.
- **Avoid** generic "Something went wrong" messages. Include what operation
  failed unless surfacing the underlying detail would expose internals or
  confuse the user.
- **Never** use `Alert.alert()` — surface errors via toasts and confirmations
  via bottom sheets.
- **Never** call `Sentry.captureException()` directly — go through
  `logger.error()` so the context tag and normalization are consistent.
- **Be selective about what reaches Sentry.** Anything that reaches Sentry as a
  top-level event should be actionable. Use the severity table above; default to
  `warn` if you're unsure (forensic context without quota cost).
