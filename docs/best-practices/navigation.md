# Navigation

## Framework

React Navigation with nested navigators (stack + tab) in `src/navigators/`.

## Navigator Hierarchy

### Root Navigator

`RootNavigator.tsx` is the entry point. It handles:

1. Jailbreak detection
2. Network initialization
3. Auth status resolution
4. Routing to Auth or Main flows

### Tab Navigator

`TabNavigator.tsx` provides the bottom tab bar for the main app sections after
authentication.

### Auth Navigator

`AuthNavigator.tsx` handles onboarding and authentication flows (create wallet,
import wallet, set password, etc.).

### Specialized Navigators

6 feature navigators handle specific areas (`AddFunds`, `ManageTokens`,
`ManageWallets`, `SendPayment`, `Settings`, `Swap`). Each manages its own stack
of screens.

## Typed Route Parameters

All navigation is fully typed with param list types:

```tsx
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

type Props = BottomTabScreenProps<
  MainTabStackParamList & RootStackParamList,
  typeof ROUTE
>;

const MyScreen: React.FC<Props> = ({ navigation, route }) => {
  const { assetCode } = route.params;
  // ...
};
```

Never use untyped `navigation.navigate()` calls.

## Route Constants

Always use named route enums instead of magic strings:

```tsx
// Correct
navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN, {
  tokenId,
  tokenSymbol,
});

// Wrong
navigation.navigate("TransactionAmountScreen", { tokenId, tokenSymbol });
```

All route enum groups are defined in `src/config/routes.ts` — check that file
for the complete current list. Each feature area has its own enum constant.

## Deep Linking

Dev and prod use separate deep-link schemes (configured in the Xcode/Gradle
build settings and the WalletConnect dashboard). WalletConnect deep links follow
the format: `<deep-link-scheme>://<optional-path>/wc?uri=wc:...`

See the native project configuration for the actual scheme values — do not
hard-code them in documentation.

## App Initialization Sequence

The `RootNavigator` orchestrates the startup sequence:

1. **Check jailbreak** — Detect rooted/jailbroken devices
2. **Initialize network** — Load saved network preference from storage
3. **Get auth status** — Determine if user is authenticated, locked, or new
4. **Trigger biometric onboarding** — If needed for first-time biometric setup
5. **Wait for dependencies** — Analytics, remote config, and auth status must
   all resolve
6. **Hide splash screen** — `RNBootSplash.hide({ fade: true })`

## Screen Parameters

Always type screen params via the param list types in `src/config/routes.ts`,
and use the route enum values as keys via computed properties. `undefined` is
the correct value for screens that take no params:

```tsx
export type SendPaymentStackParamList = {
  [SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN]: undefined;
  [SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN]: {
    tokenId: string;
    tokenSymbol: string;
  };
  [SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW]: {
    contractId: string;
    tokenId: string;
  };
};
```

Never pass untyped or ad-hoc params to `navigation.navigate()`.
