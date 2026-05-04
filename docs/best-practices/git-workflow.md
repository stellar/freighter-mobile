# Git & PR Workflow

## Branching

- **Main branch**: `main` (not `master`)
- **Branch naming**: Use `{initials}-description` format:
  - `lf-feature-biometric-onboarding` — Feature work
  - `cg-fix-token-display` — Bug fixes
  - `lf-upgrade-react-native` — Maintenance

## Commit Messages

- Use action verb in present tense: Add, Fix, Update, Improve, Cleanup, Remove
- Keep messages concise
- PR numbers are auto-added on merge (squash merge)

Examples:

- `Add biometric onboarding flow`
- `Fix WalletConnect session disconnect handling`
- `Update price fetching timeout to 3 seconds`
- `Remove deprecated auth middleware`

## Pull Request Process

### PR Template (.github/pull_request_template.md)

The PR template includes a comprehensive checklist. Key requirements:

- **JSDoc**: Add JSDoc on new functions, update JSDoc on modified functions
- **Both platforms**: Test on both iOS and Android
- **Small screens**: Test on small screen devices/simulators
- **Design approval**: UI changes need design team sign-off
- **Metrics**: Check if changes affect tracked metrics
- **Self-review**: Review your own diff before requesting reviews

### PR Expectations

- No mixed concerns (don't combine a bug fix with a refactor)
- Include screenshots or screen recordings for UI changes
- Both iOS and Android must be tested
- Small screens must be verified

## CI on Pull Requests

| Workflow          | What It Runs                     |
| ----------------- | -------------------------------- |
| `test.yml`        | Jest test suite                  |
| `ios-e2e.yml`     | Maestro iOS end-to-end tests     |
| `android-e2e.yml` | Maestro Android end-to-end tests |

All checks must pass before merging.

## Release Process

See [`RELEASE.md`](../../../../RELEASE.md) — it is the source of truth for the
release lifecycle (standard release, emergency release, post-merge steps,
nightly builds, and branch cleanup).
