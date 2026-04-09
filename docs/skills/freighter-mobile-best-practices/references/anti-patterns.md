# Anti-Patterns

This document lists common mistakes to avoid in the Freighter Mobile codebase.

## Relative Imports

ESLint enforces absolute imports from the `src/` root. Relative imports will
fail lint.

```tsx
// Wrong - will fail lint
import { useAuth } from "../../hooks/useAuth";

// Correct
import { useAuth } from "hooks/useAuth";
```

## Function Declarations for Components

All components must use arrow function expressions. Function declarations will
fail lint (`react/function-component-definition`).

```tsx
// Wrong - will fail lint
export function MyComponent({ title }: Props) {
  return <Text>{title}</Text>;
}

// Correct
export const MyComponent: React.FC<Props> = ({ title }) => {
  return <Text>{title}</Text>;
};
```

## Class Components

Class components are not used anywhere in the codebase. Always use functional
components with hooks.

## Magic Strings in Navigation

Never use raw strings for route names. Always use route enum constants.

```tsx
// Wrong
navigation.navigate("EnterAmount");

// Correct
navigation.navigate(SEND_PAYMENT_ROUTES.ENTER_AMOUNT);
```

## AsyncStorage for Sensitive Data

Never store keys, seeds, or passwords in AsyncStorage. Use the appropriate tier
from `storageFactory`:

- `secureDataStorage` for keys and seeds
- `biometricDataStorage` for biometric-gated passwords

## Untyped navigation.navigate()

Always type navigation params via the param list types. Untyped navigate calls
bypass TypeScript safety and can cause runtime crashes.

## Missing JSDoc

The PR template requires JSDoc on new functions and updated JSDoc on modified
functions. While the codebase currently has few JSDoc comments, all new code
should include them. Help improve this incrementally.

## Floating Promises

Even though `@typescript-eslint/no-floating-promises` is not currently enforced
in ESLint, avoid floating promises as a best practice. Every promise should be
`await`ed or have a `.catch()` handler.

```tsx
// Wrong - unhandled promise
fetchBalances(publicKey);

// Correct
await fetchBalances(publicKey);

// Also correct
fetchBalances(publicKey).catch((error) => {
  Sentry.captureException(normalizeError(error));
});
```

## Trusting dApp Metadata

WalletConnect session info (app name, icon, URL) comes from the dApp itself and
can be spoofed. Never use this metadata for security decisions. Always validate
the transaction content independently.

## Logging Key Material

Never `console.log` keys, seeds, or passwords, even in `__DEV__` mode. Logs can
be captured by crash reporting tools or device log viewers.

## Skipping Network Validation

Always verify the WalletConnect request chain matches the active Stellar
network. A dApp could request signing on `stellar:pubnet` while the user expects
`stellar:testnet`.

## Direct Store Mutations

Zustand's `set()` creates new state objects. Never mutate existing state
directly.

```tsx
// Wrong - mutating existing state
get().balances.push(newBalance);

// Correct - creating new state
set({ balances: [...get().balances, newBalance] });
```

## Cross-Store Action Chains

Do not have store A's action call store B's action which calls store C's action.
This creates hard-to-debug cascading updates. Keep actions independent and
compose at the hook or component level instead.

## Empty Catch Blocks

Always handle or log errors. At minimum, use `normalizeError()` + Sentry.

```tsx
// Wrong
try {
  await riskyOp();
} catch {}

// Correct
try {
  await riskyOp();
} catch (error) {
  Sentry.captureException(normalizeError(error));
}
```

## Hardcoding Test Data

Use environment variables for test secrets. Never hardcode recovery phrases,
private keys, or test passwords in source code.

```tsx
// Wrong
const testPhrase = "abandon abandon abandon ...";

// Correct
const testPhrase = process.env.E2E_TEST_RECOVERY_PHRASE;
```
