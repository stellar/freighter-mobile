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

| Attempt | Delay      |
| ------- | ---------- |
| 1       | 1 second   |
| 2       | 2 seconds  |
| 3       | 4 seconds  |
| 4       | 8 seconds  |
| 5       | 16 seconds |

Maximum of 5 retry attempts before giving up and surfacing the error.

## Toast Notifications

Surface user-facing errors via the toast system. **Never use `Alert.alert()`**
in production app code — the app uses toasts and bottom sheets for all
user-facing messaging. Exception:
`src/components/analytics/DebugBottomSheet.tsx` uses `Alert.alert()` for a
dev-only cache reset confirmation; this is an intentional debug carve-out.

```tsx
// Correct - use toast for errors
showToast({ message: t("send.errors.insufficientBalance"), type: "error" });

// Wrong - never use Alert.alert() in app code
Alert.alert("Error", "Insufficient balance");
```

For confirmations (e.g., "Are you sure you want to delete this account?"), use a
bottom sheet, not a native alert.

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

When rejecting a WalletConnect request, respond with an error message:

```tsx
await walletKit.respondSessionRequest({
  topic: session.topic,
  response: {
    id: request.id,
    jsonrpc: "2.0",
    error: { code: 5000, message: "User rejected the request" },
  },
});
```

Use `hasRespondedRef` to prevent duplicate responses to the same request:

```tsx
if (hasRespondedRef.current) return;
hasRespondedRef.current = true;
await walletKit.respondSessionRequest({ ... });
```

## Sentry Integration

`normalizeError()` feeds directly into Sentry for crash reporting. Always
normalize errors before sending to Sentry to ensure consistent, actionable
reports.

## Rules

- **Never** use empty catch blocks. Always handle or log the error.
- **Never** silently swallow errors. At minimum, log with `logger.error()`.
- **Never** show generic "Something went wrong" without additional context.
  Include what operation failed.
- **Never** use `Alert.alert()` — surface errors via toasts and confirmations
  via bottom sheets.
- **Never** call `Sentry.captureException()` directly — go through
  `logger.error()` so the context tag and normalization are consistent.
- **Be selective about what reaches Sentry.** Validation failures, user
  cancellations, and expected network failures (timeouts, offline) are noise.
  Reserve Sentry for unexpected errors and bugs that need engineering action.
