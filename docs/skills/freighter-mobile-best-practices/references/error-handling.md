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

```tsx
import { normalizeError } from "config/logger";

try {
  await riskyOperation();
} catch (error) {
  const normalized = normalizeError(error);
  Sentry.captureException(normalized);
  set({ error: normalized.message, isLoading: false });
}
```

## Type Guards

Use runtime type guards for discriminating between different data shapes:

- `isNativeBalance()` — checks if a balance is the native XLM asset
- `isClassicBalance()` — checks if a balance is a classic Stellar asset

These prevent runtime type errors when handling polymorphic data from the
network.

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

Surface user-facing errors via the toast system, not native alerts:

```tsx
// Correct - use toast for errors
showToast({ message: t("send.errors.insufficientBalance"), type: "error" });

// Wrong - avoid alert() for routine errors
Alert.alert("Error", "Insufficient balance");
```

Reserve `Alert.alert()` for critical confirmations only (e.g., "Are you sure you
want to delete this account?").

## Transaction Validation

Use `validateTransactionParams()` before building any transaction. It returns an
error message string or `null`:

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
- **Never** silently swallow errors. At minimum, use `normalizeError()` +
  Sentry.
- **Never** show generic "Something went wrong" without additional context.
  Include what operation failed.
