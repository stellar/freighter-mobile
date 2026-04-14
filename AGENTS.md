# Freighter Mobile

> Non-custodial Stellar wallet for iOS and Android. React Native app with
> Zustand state management (ducks pattern).

## Glossary

Domain terms you will encounter throughout this codebase:

| Term              | Meaning                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **Duck**          | A Zustand store module in `src/ducks/` managing a single domain of state                 |
| **XDR**           | Stellar binary serialization format used for transactions and ledger entries             |
| **WalletConnect** | Web3 protocol (v2) for dApp-to-wallet connections via `@reown/walletkit`                 |
| **RPC method**    | WalletConnect v2 handler (`stellar_signXDR`, `stellar_signAndSubmitXDR`, etc.)           |
| **Metro**         | React Native JavaScript bundler (replaces webpack); cache issues are common              |
| **Bundle ID**     | App identifier — `org.stellar.freighterdev` (dev) / `org.stellar.freighterwallet` (prod) |
| **Fastlane**      | Ruby automation for iOS/Android builds and App Store/Play Store submissions              |
| **Maestro**       | YAML-based mobile e2e test runner; flows live in `e2e/flows/`                            |
| **NativeWind**    | Tailwind CSS utility classes adapted for React Native (v4)                               |
| **rn-nodeify**    | Polyfills Node.js APIs (crypto, stream, buffer) required by the Stellar SDK              |
| **jail-monkey**   | Jailbreak/root detection library — never bypass in production code                       |

## Documentation

- [Auth Flow Architecture](./docs/auth_flow_diagram.md)
- [WalletConnect RPC Methods](./docs/walletconnect-rpc-methods.md)
- [Release Process](./RELEASE.md)
- [E2E Testing Guide](./e2e/README.md)
- [E2E CI & Triggers](./e2e/docs/ci-and-triggers.md)
- [E2E Local Setup](./e2e/docs/local-setup-and-env.md)
- [E2E Running Tests](./e2e/docs/running-tests.md)
- [E2E Debugging](./e2e/docs/artifacts-and-debugging.md)
- [E2E Creating Tests](./e2e/docs/creating-tests.md)
- [WalletConnect E2E](./e2e/docs/walletconnect-e2e-testing.md)
- [Mock dApp for Testing](./mock-dapp/README.md)
- [Getting Started](./README.md)
- [Contributing](./CONTRIBUTING.md)

## Quick Reference

| Item             | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Language         | TypeScript, React Native 0.81                            |
| Node             | >= 20 (CI: Node 20; locally 22 also works)               |
| Package Manager  | Yarn 4.10.0 (Corepack)                                   |
| State Management | Zustand 5 (ducks pattern)                                |
| Navigation       | React Navigation 7 (nested stack/tab)                    |
| Styling          | NativeWind 4 (Tailwind) + Styled Components 6            |
| Testing          | Jest 30 (unit), Maestro (e2e)                            |
| Linting          | ESLint Airbnb + TS strict + Prettier                     |
| iOS Build        | Xcode + Fastlane + CocoaPods                             |
| Android Build    | Gradle + Fastlane (SDK 36, min SDK 24, NDK 28.2, JDK 17) |
| Default Branch   | `main`                                                   |

## Build & Test Commands

```bash
yarn install                      # Install deps (runs Husky, polyfills, pods)
bundle install                    # Ruby deps (Fastlane, CocoaPods)
yarn ios                          # Run on iOS simulator
yarn android                      # Run on Android emulator
yarn start                        # Metro bundler only
yarn start-c                      # Metro with cache reset
yarn test                         # Jest unit tests
yarn check                        # lint:ts + lint:check + format:check
yarn fix                          # Auto-fix lint + format
yarn lint:translations            # Check for missing i18n keys
yarn test:e2e:ios <flow>          # Maestro e2e (iOS)
yarn test:e2e:android <flow>      # Maestro e2e (Android)
```

### Cleaning Builds (escalation order)

```bash
yarn start-c          # Clear Metro cache (try first)
yarn pod-install      # Reinstall CocoaPods
yarn node-c-install   # Remove node_modules + reinstall
yarn c-install        # Full clean (Gradle + node_modules + reinstall)
yarn r-install        # Nuclear: reset env + rebuild everything
```

## Repository Structure

```
freighter-mobile/
├── src/
│   ├── components/    # RN components (screens, templates, primitives, SDS)
│   ├── ducks/         # Zustand stores (one per domain)
│   ├── hooks/         # Custom React hooks
│   ├── helpers/       # Utility functions
│   ├── services/      # Business logic (analytics, blockaid, storage, backend)
│   ├── navigators/    # React Navigation (Root, Auth, Tab, + 6 feature navigators)
│   ├── providers/     # Context providers (AuthCheck, Network, Toast, WalletKit)
│   ├── config/        # App config (envConfig, constants, theme, routes)
│   ├── i18n/          # Translations (i18next)
│   └── polyfills/     # Node.js API polyfills for Stellar SDK
├── __tests__/         # Jest unit tests (mirrors src/)
├── __mocks__/         # Jest mocks for native modules
├── e2e/flows/         # Maestro e2e test flows
├── mock-dapp/         # WalletConnect mock dApp for local testing
├── ios/               # Native iOS project
├── android/           # Native Android project
├── fastlane/          # Release automation
└── .github/workflows/ # CI: test, ios, android, ios-e2e, android-e2e, new-release
```

## Architecture

State lives in isolated Zustand ducks (`src/ducks/`). Key stores: `auth`,
`balances`, `transactionBuilder`, `swap`, `walletKit`, `preferences`,
`networkInfo`, `history`. Access via hooks (`useAuthStore`, etc.).

Navigation uses nested React Navigation 7 navigators. Entry point:
`RootNavigator` → `AuthNavigator` or `TabNavigator` → feature navigators.

dApp connectivity via WalletConnect v2 (`src/providers/WalletKitProvider.tsx`).
4 RPC methods: `stellar_signXDR`, `stellar_signAndSubmitXDR`,
`stellar_signMessage`, `stellar_signAuthEntry`.

## Security-Sensitive Areas

Do not modify these without fully understanding the security implications:

- `src/ducks/auth.ts` — authentication state, key management
- `src/services/storage/` — secure storage (iOS Keychain / Android Keystore)
- `src/helpers/` related to signing, encryption, or key derivation
- `src/navigators/` — deep link handling (injection vector)
- `src/providers/WalletKitProvider.tsx` — WalletConnect session management
- `jail-monkey` detection — never bypass in non-test code
- `SecureClipboardService` — use this for all sensitive clipboard operations

## Known Complexity / Gotchas

- **Auth flow** is a complex state machine (sign-up, sign-in, import, lock,
  biometrics). Read `docs/auth_flow_diagram.md` before touching
  `src/ducks/auth.ts`.
- **Dual bundle IDs** mean separate signing configs, push tokens, and deep link
  schemes. Don't mix dev/prod identifiers.
- **Version bumps** require touching 5 files simultaneously. Use
  `yarn set-app-version` — do not edit them manually.
- **Metro cache** is the first culprit for unexplained build failures; run
  `yarn start-c` before investigating further.
- **Polyfills** (`rn-nodeify`) must stay in sync with the Stellar SDK version —
  don't remove or update without testing cryptographic operations.
- **Blockaid** transaction scanning is integrated into sign flows. Don't bypass
  or weaken — it's a security control.
- **Pre-commit hooks** run the full test suite + TypeScript check. This is
  intentional and slow on large changesets.

## Pre-submission Checklist

```bash
yarn check                        # Lint + format must pass
yarn test                         # Unit tests must pass
# Then test manually on both iOS and Android simulators
```

## Best Practices Entry Points

Read the relevant file when working in that area:

| Concern              | Entry Point                                                                | When to Read                                        |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| Code Style           | `docs/skills/freighter-mobile-best-practices/references/code-style.md`     | Writing or reviewing any code                       |
| Architecture         | `docs/skills/freighter-mobile-best-practices/references/architecture.md`   | Adding features, understanding state/nav structure  |
| Styling              | `docs/skills/freighter-mobile-best-practices/references/styling.md`        | Creating or modifying UI components                 |
| Security             | `docs/skills/freighter-mobile-best-practices/references/security.md`       | Touching keys, auth, storage, or dApp interactions  |
| Testing              | `docs/skills/freighter-mobile-best-practices/references/testing.md`        | Writing or fixing tests                             |
| Performance          | `docs/skills/freighter-mobile-best-practices/references/performance.md`    | Optimizing renders, lists, images, or startup       |
| Error Handling       | `docs/skills/freighter-mobile-best-practices/references/error-handling.md` | Adding error states, retries, or user-facing errors |
| Internationalization | `docs/skills/freighter-mobile-best-practices/references/i18n.md`           | Adding or modifying user-facing strings             |
| WalletConnect        | `docs/skills/freighter-mobile-best-practices/references/walletconnect.md`  | Working with dApp connections or RPC methods        |
| Navigation           | `docs/skills/freighter-mobile-best-practices/references/navigation.md`     | Adding screens, deep links, or navigation flows     |
| Git & PR Workflow    | `docs/skills/freighter-mobile-best-practices/references/git-workflow.md`   | Branching, committing, opening PRs, CI, releases    |
| Dependencies         | `docs/skills/freighter-mobile-best-practices/references/dependencies.md`   | Adding, updating, or auditing packages              |
| Anti-Patterns        | `docs/skills/freighter-mobile-best-practices/references/anti-patterns.md`  | Code review, avoiding common mistakes               |
