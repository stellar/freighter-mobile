# Freighter Mobile — AI Agent Context

> Non-custodial Stellar wallet for iOS and Android. React Native app with
> Zustand state management.

## Quick Reference

| Item             | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| Language         | TypeScript, React Native 0.81                             |
| React            | 19.1                                                      |
| Node             | >= 20 (CI uses Node 20; locally 22 also works)            |
| Package Manager  | Yarn 4.10.0 (Corepack-managed via `packageManager` field) |
| State Management | Zustand 5 (ducks pattern)                                 |
| Navigation       | React Navigation 7 (nested stack/tab)                     |
| Styling          | NativeWind 4 (Tailwind) + Styled Components 6             |
| Animations       | Reanimated 4 + Skia 2                                     |
| Blockchain       | @stellar/stellar-sdk 14                                   |
| WalletConnect    | @reown/walletkit 1.4 (v2 protocol)                        |
| Secure Storage   | react-native-keychain (iOS Keychain / Android Keystore)   |
| Analytics        | Amplitude 1.5                                             |
| Error Tracking   | Sentry 7                                                  |
| Testing          | Jest 30 (unit), Maestro (e2e)                             |
| Linting          | ESLint (Airbnb + TS strict) + Prettier                    |
| CI               | GitHub Actions (6 workflows)                              |
| iOS Build        | Xcode + Fastlane + CocoaPods                              |
| Android Build    | Gradle + Fastlane (SDK 36, min SDK 24, NDK 28.2, JDK 17)  |
| Ruby             | >= 2.6.10 (for Fastlane and Android launch scripts)       |
| Default Branch   | `main`                                                    |

## Build & Test Commands

```bash
yarn install                      # Install deps (postinstall runs Husky, polyfills, pods)
bundle install                    # Ruby deps (Fastlane, CocoaPods)
yarn ios                          # Run on iOS simulator (dev)
yarn android                      # Run on Android emulator (dev)
yarn start                        # Metro bundler only
yarn start-c                      # Metro with cache reset
yarn test                         # Jest unit tests
yarn test:watch                   # Jest watch mode
yarn check                        # All checks (lint:ts + lint:check + format:check)
yarn fix                          # Auto-fix all (lint + format)
yarn lint:translations            # Check for missing i18n keys
yarn test:e2e:ios <flow>          # Maestro e2e (iOS)
yarn test:e2e:android <flow>      # Maestro e2e (Android)
```

**Cleaning builds** (escalation order):

```bash
yarn start-c          # Clear Metro cache
yarn pod-install      # Reinstall CocoaPods
yarn node-c-install   # Remove node_modules + reinstall
yarn c-install        # Full clean (Gradle + node_modules + reinstall)
yarn r-install        # Nuclear: reset env + rebuild everything
```

See `package.json` for all scripts including device builds, release builds, and
AAB bundles.

## Repository Structure

```
freighter-mobile/
├── src/
│   ├── components/       # React Native components (shared, screens, templates, primitives, SDS)
│   ├── ducks/            # Zustand stores (24 isolated state modules)
│   ├── hooks/            # Custom React hooks (57 hooks)
│   ├── helpers/          # Utility functions (47 modules)
│   ├── services/         # Business logic & APIs (analytics, blockaid, storage, backend)
│   ├── navigators/       # React Navigation (9 navigators: Root, Auth, Tab, SendPayment, Swap, ManageWallets, Settings, ManageTokens, AddFunds)
│   ├── providers/        # Context providers (AuthCheck, Network, Toast, WalletKit)
│   ├── config/           # App configuration (envConfig, constants, theme, colors, routes, sentry, analytics)
│   ├── types/            # Shared TypeScript type definitions
│   ├── i18n/             # Translations (i18next)
│   ├── assets/           # Fonts
│   ├── polyfills/        # Node.js API polyfills for React Native
│   ├── eslint-plugin-translations/  # Custom ESLint plugin for translation enforcement
│   └── index.ts          # Entry point
├── __tests__/            # Jest unit tests (mirrors src/ structure)
├── __mocks__/            # Jest mocks for native modules (21 modules)
├── e2e/                  # Maestro e2e tests
│   ├── flows/            # Test flows (onboarding, transactions, walletconnect)
│   └── docs/             # 6 testing guides
├── mock-dapp/            # WalletConnect mock dApp for testing
├── ios/                  # Native iOS project
├── android/              # Native Android project
├── fastlane/             # Fastlane automation for releases
├── scripts/              # Build, version, and setup scripts
├── patches/              # Yarn patches for dependency fixes
├── docs/                 # Architecture docs
│   ├── auth_flow_diagram.md        # Auth system (413-line Mermaid diagram)
│   └── walletconnect-rpc-methods.md  # 4 RPC method specs
└── .github/workflows/    # CI: test.yml, ios.yml, android.yml, ios-e2e.yml, android-e2e.yml, new-release.yml
```

## Architecture

### State Management (Zustand Ducks)

State is organized as isolated Zustand stores in `src/ducks/`. Each duck manages
a specific domain. Key stores:

- `auth.ts` — authentication state, lock/unlock, biometrics
- `balances.ts` — account balances, token lists
- `transactionBuilder.ts` — transaction construction state
- `swap.ts` / `swapSettings.ts` — asset swap flow
- `walletKit.ts` — WalletConnect session state
- `preferences.ts` — user settings
- `networkInfo.ts` — network configuration
- `prices.ts` — asset price data
- `history.ts` — transaction history
- `collectibles.ts` — NFT/collectible data
- `remoteConfig.ts` — remote feature flags
- `analytics.ts` — analytics tracking state

Stores are accessed via hooks (e.g., `useAuthStore`, `useBalancesStore`).

### Navigation

React Navigation 7 with nested navigators:

- `RootNavigator` — top-level, switches between auth and main app
- `AuthNavigator` — sign-up, sign-in, import wallet flows
- `TabNavigator` — bottom tab bar (home, swap, settings, etc.)
- Feature navigators: `SendPaymentNavigator`, `SwapNavigator`,
  `ManageWalletsNavigator`, `SettingsNavigator`, `ManageTokensNavigator`,
  `AddFundsNavigator`

Deep linking: `freighterdev://` (dev) / `freighterwallet://` (prod).

### WalletConnect

dApp connectivity via WalletConnect v2 (@reown/walletkit). Provider in
`src/providers/WalletKitProvider.tsx`. Supports 4 RPC methods:
`stellar_signXDR`, `stellar_signAndSubmitXDR`, `stellar_signMessage`,
`stellar_signAuthEntry`. See `docs/walletconnect-rpc-methods.md`.

### Dual Build Environments

|           | Development                | Production                    |
| --------- | -------------------------- | ----------------------------- |
| Bundle ID | `org.stellar.freighterdev` | `org.stellar.freighterwallet` |
| Deep Link | `freighterdev://`          | `freighterwallet://`          |
| Amplitude | Disabled                   | Enabled                       |
| Backend   | Switchable (dev/stg/prod)  | Fixed to prod                 |

Both can coexist on the same device. Env vars loaded via `react-native-config`,
resolved in `src/config/envConfig.ts`.

## Key Conventions

- **Absolute imports:** Always from `src/` root (e.g.,
  `import { useAuth } from "hooks/useAuth"`). No relative paths. Enforced by
  `@fnando/eslint-plugin-consistent-import`. Resolved via `tsconfig.json`
  baseUrl + Babel module-resolver.
- **Arrow functions:** All React components must use arrow functions. Enforced
  by ESLint.
- **Formatting:** Double quotes, 2-space indent, trailing commas, 80-char width,
  semicolons. Config in `.prettierrc.json`.
- **Import sorting:** Auto-sorted by `@trivago/prettier-plugin-sort-imports`
  (builtin > external > internal > parent > sibling).
- **JSDoc:** Required on all new public functions (enforced by PR template).
- **Translations:** All user-facing strings through `i18next`. Use
  `useAppTranslation` hook. Custom ESLint plugin
  (`src/eslint-plugin-translations/`) flags missing translations.
- **Branch naming:** `{initials}-description` (e.g., `lf-feature-name`,
  `cg-fix-token-display`).

## Security-Sensitive Areas

These areas require careful review:

- `src/ducks/auth.ts` — authentication state, key management
- `src/services/storage/` — secure storage via react-native-keychain (iOS
  Keychain / Android Keystore)
- `src/services/` — API calls, key management, secure storage access
- `src/helpers/` related to signing, encryption, or key derivation
- `src/navigators/` — deep link handling (potential injection vector)
- `src/providers/WalletKitProvider.tsx` — WalletConnect session management
- Authentication flows — see `docs/auth_flow_diagram.md` for the complete
  security model
- WalletConnect RPC handlers — external dApp requests that trigger signing
- Jailbreak/root detection via `jail-monkey` — don't bypass
- Clipboard handling — use `SecureClipboardService` for sensitive data

## Known Complexity

- **Auth flow:** Complex state machine with multiple paths (sign-up, sign-in,
  import, lock screen, biometrics). Fully documented in
  `docs/auth_flow_diagram.md` with a 413-line Mermaid diagram.
- **Dual bundle IDs:** `org.stellar.freighterdev` (dev) vs
  `org.stellar.freighterwallet` (prod). Separate signing configs, push
  notification tokens, and deep link schemes.
- **Version bumps:** Touch 5 files (package.json, build.gradle, 2 iOS plists,
  project.pbxproj). Use `yarn set-app-version`.
- **Pre-commit hooks:** Run lint-staged + full test suite + TypeScript check.
  Can be slow on large changesets.
- **Blockaid:** Transaction scanning (via `@blockaid/client`) integrated into
  sign flows. Don't bypass or weaken.
- **Environment switching:** Dev builds allow switching backend env
  (dev/stg/prod) via in-app settings. Config in
  `src/config/devBackendConfig.ts`.
- **Polyfills:** Node.js APIs (crypto, stream, buffer, etc.) polyfilled via
  rn-nodeify for Stellar SDK compatibility.
