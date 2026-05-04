# Architecture

## Layer Structure

The codebase follows a layered architecture with a generally downward import
direction:

```
components (UI)
    -> hooks (logic)
        -> ducks (state)
            -> services (APIs)
                -> helpers (utilities)
                    -> types
```

Each layer generally imports from the layers below it. Services may read from
ducks via `getState()` when they need app state (e.g., analytics services read
`useAnalyticsStore`, `useAuthenticationStore`, `useNetworkStore`). Ducks must
not import from hooks or components.

## Zustand Duck Pattern

State management uses Zustand with a "duck" pattern. Each store (duck) lives in
`src/ducks/` and follows this structure:

### Persistence

For state that should survive app restarts (user preferences, cached metadata),
Zustand's `persist` middleware with `AsyncStorage` is a common option — see
`src/ducks/preferences.ts` for an example. It's not required for every store;
evaluate case by case whether the state needs to outlive the session. Do not
persist sensitive data — use `secureDataStorage` instead (see `security.md`).

```tsx
// src/ducks/prices.ts
import { create } from "zustand";

interface PricesState {
  // State
  prices: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  currentRequestId: string | null;

  // Actions
  fetchPrices: (assetCodes: string[]) => Promise<void>;
  clearPrices: () => void;
}

export const usePricesStore = create<PricesState>((set, get) => ({
  prices: {},
  isLoading: false,
  error: null,
  currentRequestId: null,

  fetchPrices: async (assetCodes) => {
    const requestId = createRequestId();
    set({ isLoading: true, error: null, currentRequestId: requestId });

    try {
      const prices = await pricesService.getPrices(assetCodes);
      // Check staleness before setting
      if (get().currentRequestId !== requestId) return;
      set({ prices, isLoading: false });
    } catch (error) {
      if (get().currentRequestId !== requestId) return;
      set({ error: normalizeError(error).message, isLoading: false });
    }
  },

  clearPrices: () => set({ prices: {}, error: null }),
}));
```

### Async Action Pattern

Async actions follow this general sequence:

1. Set loading state: `set({ isLoading: true, error: null })`
2. Call the service layer
3. Set result or error state

Use the `createRequestId()` staleness pattern only when concurrent calls to the
same action could produce stale results (e.g., `transactionBuilder.ts`). For all
other async actions, simple try/catch is sufficient.

### Store Interaction

- Stores can read each other via `getState()`:
  `usePricesStore.getState().prices`
- Prefer passing data as action parameters over cross-store reads
- Never have store A's action call store B's action which calls store C's action

## Screen Structure

Complex screens use a directory layout that scales to the flow's complexity:

```
src/components/screens/SendScreen/
  index.tsx                    # Screen entry point / coordinator
  screens/                     # Sub-screens for multi-step flows
  components/                  # Screen-specific UI components
  hooks/                       # Screen-specific logic hooks
```

Simple, single-view screens may be a single file — the structure above is a
pattern, not a requirement. Add subdirectories only when the screen grows to
need them.

## Hook Composition

Reusable hooks live in `src/hooks/` and encapsulate common logic. Screens
compose multiple hooks together:

```tsx
const TransactionAmountScreen: React.FC = () => {
  const { account } = useGetActiveAccount();
  const { buildTransaction, transactionXDR, isBuilding, error } =
    useTransactionBuilderStore();
  const { isValidatingMemo, isMemoMissing } =
    useValidateTransactionMemo(transactionXDR);
  const { scanTransaction } = useBlockaidTransaction();
  // ... compose the flow
};
```

## Service Layer

Services live in `src/services/` and handle all external API communication:

- `apiFactory.ts` provides `createApiService()` with configurable `baseURL`
- All service functions return typed responses
- Retry configuration is handled at the service level

## Provider Layer

`src/providers/` contains app-wide context providers:

- `AuthCheckProvider` — gates navigation based on authentication state
- `NetworkProvider` — tracks active Stellar network (mainnet / testnet)
- `ToastProvider` — app-wide toast notification system
- `WalletKitProvider` — WalletConnect session management

## Config

`src/config/` holds constants, colors, theme, and environment-specific values
used across the app.

## Dual Bundle IDs

The app maintains separate identities for development and production:

| Concern          | Dev                        | Prod                          |
| ---------------- | -------------------------- | ----------------------------- |
| Bundle ID        | `org.stellar.freighterdev` | `org.stellar.freighterwallet` |
| Signing          | Dev certificates           | Prod certificates             |
| Deep link scheme | Separate per environment   | Separate per environment      |
| Keychain entries | Isolated                   | Isolated                      |

This isolation ensures dev builds never interfere with production data or
credentials.
