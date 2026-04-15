# Architecture

## Layer Structure

The codebase follows a layered architecture with a strict downward import
direction:

```
components (UI)
    -> hooks (logic)
        -> ducks (state)
            -> services (APIs)
                -> helpers (utilities)
                    -> types
```

Each layer may import from the layers below it but never from the layers above.
This ensures a clean dependency graph and prevents circular imports.

## Zustand Duck Pattern

State management uses Zustand with a "duck" pattern. Each store (duck) lives in
`src/ducks/` and follows this structure:

```tsx
// src/ducks/prices.ts
import { create } from "zustand";

interface PricesState {
  // State
  prices: Record<string, number>;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPrices: (assetCodes: string[]) => Promise<void>;
  clearPrices: () => void;
}

export const usePricesStore = create<PricesState>((set, get) => ({
  prices: {},
  isLoading: false,
  error: null,

  fetchPrices: async (assetCodes) => {
    const requestId = generateRequestId();
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

For actions prone to race conditions (e.g., `transactionBuilder.ts`), a
`generateRequestId()` pattern is used to check staleness before applying
results. This pattern is NOT universal — most stores (like `prices.ts`,
`balances.ts`) use simpler try/catch without request IDs. Use the request ID
pattern only when concurrent calls to the same action could produce stale
results.

### Store Interaction

- Stores can read each other via `getState()`:
  `usePricesStore.getState().prices`
- Prefer passing data as action parameters over cross-store reads
- Never have store A's action call store B's action which calls store C's action

## Screen Structure

Each screen follows a consistent directory layout:

```
src/screens/SendPayment/
  index.tsx                    # Screen entry point / coordinator
  screens/                     # Sub-screens for multi-step flows
    SelectAsset.tsx
    EnterAmount.tsx
    ConfirmTransaction.tsx
  components/                  # Screen-specific UI components
    RecipientInput.tsx
    AmountDisplay.tsx
  hooks/                       # Screen-specific logic hooks
    useSendPaymentFlow.ts
    useValidateRecipient.ts
```

## Hook Composition

Reusable hooks live in `src/hooks/` and encapsulate common logic. Screens
compose multiple hooks together:

```tsx
const SendPaymentScreen: React.FC = () => {
  const { activeAccount } = useGetActiveAccount();
  const { buildTransaction } = useTransactionBuilderStore();
  const { validateMemo } = useValidateTransactionMemo();
  const { scanResult } = useBlockaidTransaction();
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

- `WalletKitProvider` for WalletConnect
- Theme provider
- Other app-wide concerns

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
