# Contributing to Freighter Mobile

Non-custodial Stellar wallet for iOS and Android. Built with React Native,
Zustand, and React Navigation.

For the Stellar organization's general contribution guidelines, see the
[Stellar Contribution Guide](https://github.com/stellar/.github/blob/master/CONTRIBUTING.md).

## Prerequisites

| Tool           | Version       | Install                                                           |
| -------------- | ------------- | ----------------------------------------------------------------- |
| Node.js        | >= 22         | [nodejs.org](https://nodejs.org) or `nvm install 22`              |
| Yarn           | 4.10.0        | `corepack enable && corepack prepare yarn@4.10.0 --activate`      |
| Ruby           | >= 2.6.10     | [rbenv](https://github.com/rbenv/rbenv) or [rvm](https://rvm.io/) |
| Watchman       | Latest        | `brew install watchman`                                           |
| JDK            | 17            | [Adoptium](https://adoptium.net/) or Android Studio               |
| Xcode          | Latest stable | Mac App Store (iOS only)                                          |
| Android Studio | Latest stable | [developer.android.com](https://developer.android.com/studio)     |
| Maestro CLI    | Latest        | `brew install mobile-dev-inc/tap/maestro` (e2e tests only)        |

**Android SDK requirements** (install via Android Studio SDK Manager):

- SDK Platform API 36, Build-Tools 36.0.0, NDK 28.2.13676358

**Shell environment** — add to `~/.zshrc` or `~/.bashrc`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
```

For full platform setup, see the
[React Native Environment Setup](https://reactnative.dev/docs/set-up-your-environment)
guide.

## Getting Started

### Quick Setup with an LLM

If you use [Claude Code](https://claude.ai/code) or another LLM-powered coding
assistant, you can automate the setup. The repo includes a skill that checks
your environment, installs missing tools, configures `.env`, and verifies the
build.

After cloning the repo, run:

```bash
claude "/freighter-dev-setup"
```

The skill will:

1. Check all prerequisites (Node, Yarn, Ruby, JDK, Xcode, Android SDK, etc.)
2. Install what it can automatically (with your confirmation)
3. Produce a list of manual steps for anything it couldn't install
4. Set up `.env` with public backend endpoints and guide you through the
   remaining variables
5. Run verification to confirm the build works

If you don't use Claude Code, follow the manual setup below.

### Manual Setup

```bash
git clone https://github.com/stellar/freighter-mobile.git
cd freighter-mobile
bundle install        # Ruby deps (Fastlane, CocoaPods)
yarn install          # Node deps + auto-runs postinstall (Husky, polyfills, pods)
cp .env.example .env  # Then fill in values (see below)
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values. The `.env` file must
**never** be committed.

**Required — app won't build or function without these:**

| Variable                            | How to set up                                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FREIGHTER_BACKEND_V1_DEV_URL`      | `https://freighter-backend-dev.stellar.org/api/v1`. If unavailable, use `-stg` or `-prd`. Or run your own from [stellar/wallet-backend](https://github.com/stellar/wallet-backend)                                       |
| `FREIGHTER_BACKEND_V2_DEV_URL`      | `https://freighter-backend-v2-dev.stellar.org/api/v1`. If unavailable, use `-stg` or prod (`freighter-backend-v2.stellar.org`). Or run your own from [stellar/wallet-backend](https://github.com/stellar/wallet-backend) |
| `WALLET_KIT_PROJECT_ID_DEV`         | Create a free project at [dashboard.reown.com](https://dashboard.reown.com) — sign up, create a new project (type: Wallet), copy the Project ID                                                                          |
| `WALLET_KIT_MT_NAME_DEV`            | Your project name from the Reown dashboard                                                                                                                                                                               |
| `WALLET_KIT_MT_DESCRIPTION_DEV`     | Your project description                                                                                                                                                                                                 |
| `WALLET_KIT_MT_URL_DEV`             | Your project URL                                                                                                                                                                                                         |
| `WALLET_KIT_MT_ICON_DEV`            | Your project icon URL                                                                                                                                                                                                    |
| `WALLET_KIT_MT_REDIRECT_NATIVE_DEV` | Deep link scheme matching your dev bundle ID                                                                                                                                                                             |
| `ANDROID_DEBUG_KEYSTORE_PASSWORD`   | Android Studio's default: `android`                                                                                                                                                                                      |
| `ANDROID_DEBUG_KEYSTORE_ALIAS`      | Android Studio's default: `androiddebugkey`                                                                                                                                                                              |
| `ANDROID_DEV_KEYSTORE_PASSWORD`     | Generate your own keystore with `keytool -genkey -v -keystore dev.keystore -alias dev -keyalg RSA -keysize 2048 -validity 10000`, then use the password you set                                                          |
| `ANDROID_DEV_KEYSTORE_ALIAS`        | The alias you chose when generating the keystore (e.g., `dev`)                                                                                                                                                           |

**Optional — features degrade gracefully without these:**

| Variable                                     | Notes                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `AMPLITUDE_API_KEY`                          | Auto-disabled in `__DEV__` mode — not needed for local dev                                 |
| `SENTRY_DSN`                                 | Leave empty — errors log to console instead                                                |
| `FREIGHTER_BACKEND_*_STG_URL` / `*_PROD_URL` | Only needed for staging/prod builds. Same public endpoints with `-stg` or `-prd` subdomain |
| `WALLET_KIT_*_PROD` (6 vars)                 | Only needed for prod builds — same setup as dev vars above                                 |
| `ANDROID_PROD_KEYSTORE_*`                    | Only needed for release builds — generate a separate keystore                              |
| `MP_COLLECTIONS_ADDRESSES`                   | Comma-separated list — leave empty if not working on collectibles                          |

**E2E testing only:**

| Variable                          | Notes                                                                                                                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IS_E2E_TEST`                     | Set to `true` when running Maestro                                                                                                                                                                                                     |
| `E2E_TEST_RECOVERY_PHRASE`        | Generate a new wallet via any Stellar wallet and copy the 12/24-word phrase (used by `CreateWallet`/`ImportWallet` flows)                                                                                                              |
| `E2E_TEST_FUNDED_RECOVERY_PHRASE` | Recovery phrase for an account **funded on mainnet** with real XLM. Required by `SendClassicTokenMainnet` and `SwapClassicTokenMainnet` flows which execute real transactions on mainnet. Fund the account before running these tests. |

See `.env.example` for the full list with inline comments.

### Run the App

```bash
yarn ios              # iOS simulator (dev)
yarn android          # Android emulator (dev)
yarn start            # Metro bundler only (starts automatically with above)
```

Dev and prod builds use separate bundle IDs (`org.stellar.freighterdev` /
`org.stellar.freighterwallet`) and can coexist on the same device. See
`package.json` for all run commands including device and release variants.

## Key Commands

```bash
yarn test             # Jest unit tests
yarn check            # All checks (TypeScript + ESLint + Prettier)
yarn fix              # Auto-fix lint + format
yarn lint:translations  # Check for missing i18n keys
yarn test:e2e:ios <flow>     # Maestro e2e (iOS)
yarn test:e2e:android <flow> # Maestro e2e (Android)
```

**Cleaning builds** (escalation order):

```bash
yarn start-c          # Clear Metro cache
yarn pod-install      # Reinstall CocoaPods
yarn node-c-install   # Remove node_modules + reinstall
yarn c-install        # Full clean (Gradle + node_modules + reinstall)
yarn r-install        # Nuclear: reset env + rebuild everything
```

See `package.json` for the complete list of scripts.

## Code Conventions

- **Formatting:** Double quotes, 2-space indent, trailing commas, 80-char width,
  semicolons. Enforced by Prettier (`.prettierrc.json`).
- **Linting:** Airbnb + TypeScript strict + custom translations plugin. Config
  in `eslint.config.mjs`.
- **Absolute imports:** Always from `src/` root — no relative paths. Enforced by
  ESLint.
- **Arrow functions:** Required for React components. Enforced by ESLint.
- **Import sorting:** Auto-handled by `@trivago/prettier-plugin-sort-imports`.
- **JSDoc:** Required on all new/modified public functions (see
  [PR template](.github/pull_request_template.md)).
- **Translations:** All user-facing strings through `i18next`. Use
  `useAppTranslation` hook. The custom ESLint plugin flags missing translations.

### Pre-commit Hooks

Husky runs on every commit:

1. `lint-staged` — ESLint fix + Prettier on staged files
2. `yarn test` — full unit test suite
3. `yarn lint:ts` — TypeScript type check

All must pass before the commit succeeds.

## Testing

**Unit tests:** Jest with `@testing-library/react-native`. Tests in
`__tests__/`, mocks in `__mocks__/`.

**E2E tests:** Maestro flows in `e2e/flows/` — see the [e2e docs](e2e/docs/) for
setup, writing tests, and debugging.

**Before submitting a PR:** `yarn test` + `yarn lint:ts` must pass. Test on both
iOS and Android, including small screens.

## Pull Requests

- Branch from `main` using your initials + description: `lf-feature-name`,
  `cg-fix-token-display`
- Commit messages: start with action verb (`Add`, `Fix`, `Update`, `Improve`)
- No mixed concerns — keep refactoring separate from features
- Include before/after screenshots for UI changes
- Follow the full checklist in the
  [PR template](.github/pull_request_template.md)

**CI runs on every PR:** unit tests (`test.yml`), iOS e2e (`ios-e2e.yml`),
Android e2e (`android-e2e.yml`). All must pass.

## Security

Freighter handles private keys and signs transactions. When contributing:

- **Never log or expose** private keys, seed phrases, or passwords
- **Use `react-native-keychain`** (iOS Keychain / Android Keystore) for secrets
  — never AsyncStorage
- **Validate all external data** — WalletConnect payloads, API responses, deep
  links
- **Don't weaken Blockaid** transaction scanning or `jail-monkey` jailbreak
  detection
- **Report vulnerabilities** via the
  [Stellar Security Policy](https://github.com/stellar/.github/blob/master/SECURITY.md)
  — not public issues

See [`docs/auth_flow_diagram.md`](docs/auth_flow_diagram.md) for the full auth
security model.

## Further Reading

| Topic                     | Location                                                                 |
| ------------------------- | ------------------------------------------------------------------------ |
| Auth architecture         | [`docs/auth_flow_diagram.md`](docs/auth_flow_diagram.md)                 |
| WalletConnect RPC methods | [`docs/walletconnect-rpc-methods.md`](docs/walletconnect-rpc-methods.md) |
| E2E testing (6 guides)    | [`e2e/docs/`](e2e/docs/)                                                 |
| Mock dApp for testing     | [`mock-dapp/README.md`](mock-dapp/README.md)                             |
| Release process           | [`RELEASE.md`](RELEASE.md)                                               |
| All scripts & commands    | `package.json`                                                           |

**Questions?** Open a
[GitHub Discussion](https://github.com/stellar/freighter-mobile/discussions) or
join the [Stellar Developer Discord](https://discord.gg/stellardev).
