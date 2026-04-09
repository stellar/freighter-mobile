# AGENTS.md

> Freighter Mobile -- Non-custodial Stellar wallet for iOS and Android. React
> Native app with Zustand state management (ducks pattern).

## Setup commands

- Install deps: `yarn install` (postinstall runs Husky, polyfills, pods)
- Ruby deps: `bundle install` (Fastlane, CocoaPods)
- Run iOS: `yarn ios`
- Run Android: `yarn android`
- Metro bundler: `yarn start`
- Metro with cache reset: `yarn start-c`
- Run unit tests: `yarn test`
- Run unit tests (watch): `yarn test:watch`
- Run all checks: `yarn check` (lint:ts + lint:check + format:check)
- Auto-fix all: `yarn fix` (lint + format)
- Check translations: `yarn lint:translations`
- E2E iOS: `yarn test:e2e:ios <flow>`
- E2E Android: `yarn test:e2e:android <flow>`

## Cleaning builds (escalation order)

```bash
yarn start-c          # Clear Metro cache
yarn pod-install      # Reinstall CocoaPods
yarn node-c-install   # Remove node_modules + reinstall
yarn c-install        # Full clean (Gradle + node_modules + reinstall)
yarn r-install        # Nuclear: reset env + rebuild everything
```

## Code style

- Double quotes, 2-space indent, trailing commas, 80-char width, semicolons
- Config in `.prettierrc.json`
- ESLint: Airbnb + TypeScript strict
- Arrow functions required for React components (ESLint enforced)
- Absolute imports from `src/` root (enforced by
  `@fnando/eslint-plugin-consistent-import`)
- Import sorting auto-applied by `@trivago/prettier-plugin-sort-imports`
- For detailed rules:
  `docs/skills/freighter-mobile-best-practices/references/code-style.md`

## Testing instructions

- Unit tests: `yarn test` (Jest, react-native preset)
- Tests live in `__tests__/` mirroring `src/` structure
- E2E: Maestro YAML flows in `e2e/flows/`
- JSDoc required on all new public functions (enforced by PR template)
- For detailed patterns:
  `docs/skills/freighter-mobile-best-practices/references/testing.md`

## PR instructions

- Branch naming: `{initials}-description` (e.g., `lf-feature-name`)
- Commit messages: imperative action verb + description
- Default branch: `main`
- Test on both iOS and Android before submitting
- Test on small screen devices/simulators
- Run `yarn check` before pushing
- For detailed workflow:
  `docs/skills/freighter-mobile-best-practices/references/git-workflow.md`

## Security considerations

These areas require careful review:

- `src/ducks/auth.ts` -- authentication state, key management
- `src/services/storage/` -- secure storage via react-native-keychain
- `src/helpers/` related to signing, encryption, or key derivation
- `src/navigators/` -- deep link handling (potential injection vector)
- `src/providers/WalletKitProvider.tsx` -- WalletConnect session management
- Jailbreak/root detection via `jail-monkey` -- don't bypass
- Clipboard: use `SecureClipboardService` for sensitive data
- For detailed rules:
  `docs/skills/freighter-mobile-best-practices/references/security.md`

## Architecture

- State: Zustand 5 (ducks pattern) -- isolated stores in `src/ducks/`
- Navigation: React Navigation 7 (nested stack/tab) in `src/navigators/`
- Styling: NativeWind 4 (Tailwind) + Styled Components 6
- WalletConnect: @reown/walletkit (v2 protocol, 4 RPC methods)
- Dual bundle IDs: `org.stellar.freighterdev` (dev) /
  `org.stellar.freighterwallet` (prod)

For detailed architecture:
`docs/skills/freighter-mobile-best-practices/references/architecture.md`

## Best practices entry points

Detailed best practices are split by concern area. Read the relevant file when
working in that domain:

| Concern              | Entry Point                                                                | When to Read                                        |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| Code Style           | `docs/skills/freighter-mobile-best-practices/references/code-style.md`     | Writing or reviewing any code                       |
| Architecture         | `docs/skills/freighter-mobile-best-practices/references/architecture.md`   | Adding features, understanding the codebase         |
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

## Key documentation

| Topic                     | Location                            |
| ------------------------- | ----------------------------------- |
| Auth flow diagram         | `docs/auth_flow_diagram.md`         |
| WalletConnect RPC methods | `docs/walletconnect-rpc-methods.md` |
| Release process           | `RELEASE.md`                        |
| E2E testing guide         | `e2e/README.md`                     |
| E2E CI & triggers         | `e2e/docs/ci-and-triggers.md`       |
| Mock dApp                 | `mock-dapp/README.md`               |
