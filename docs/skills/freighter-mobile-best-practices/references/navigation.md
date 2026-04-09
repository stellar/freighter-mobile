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

Approximately 7 additional navigators handle specific feature areas (send
payment, swap, settings, etc.). Each manages its own stack of screens.

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
navigation.navigate(SEND_PAYMENT_ROUTES.ENTER_AMOUNT, { assetCode: "XLM" });

// Wrong
navigation.navigate("EnterAmount", { assetCode: "XLM" });
```

Available route enum groups:

- `ROOT_NAVIGATOR_ROUTES`
- `MAIN_TAB_ROUTES`
- `SEND_PAYMENT_ROUTES`
- And others per feature area

## Deep Linking

| Environment | Scheme               |
| ----------- | -------------------- |
| Dev         | `freighterdev://`    |
| Prod        | `freighterwallet://` |

WalletConnect deep links follow the format: `freighterdev://wc?uri=...`

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

Always type screen params via the param list types. Optional params are marked
with `?`:

```tsx
type SendPaymentParamList = {
  SelectAsset: undefined;
  EnterAmount: { assetCode: string; assetIssuer?: string };
  ConfirmTransaction: {
    amount: string;
    destination: string;
    assetCode: string;
  };
};
```

Never pass untyped or ad-hoc params to `navigation.navigate()`.
