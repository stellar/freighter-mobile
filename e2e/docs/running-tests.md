# Running Tests

How to run E2E tests in CI, locally, and how to run a **single flow** by
platform and name.

## CI

Tests run automatically on triggers described in
[CI & Triggers](ci-and-triggers.md). Each matrix job runs exactly one flow (e.g.
`CreateWallet`) on Android or iOS. The project script `run-e2e-tests.sh` is
invoked with `--platform`, `--shard-index`, `--shard-total`, and the flow name.

## Local

### Prerequisites

- Maestro installed, `.env` configured (see
  [Local Setup & Env](local-setup-and-env.md)).
- App built and running in simulator (iOS) or emulator (Android).
- For iOS: `run-e2e-tests.sh` will set the simulator clipboard with
  `E2E_TEST_RECOVERY_PHRASE` for Import Wallet.

### Commands

> ⚠️ **Note:** While you can run all flows locally with the commands below, it
> is advisable to avoid this for local testing—it takes a long time to run them
> all at once. In CI, this never happens: each flow is always executed in a
> separate job, running in parallel. For efficient workflow, see the
> [Run a single flow](#run-a-single-flow) section below for details on running
> just the flow you need.

| Command                 | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `yarn test:e2e`         | Run all flows; auto-detect device if only one booted     |
| `yarn test:e2e:ios`     | Run all flows on **iOS** (booted simulator)              |
| `yarn test:e2e:android` | Run all flows on **Android** (connected device/emulator) |

These call `./scripts/run-e2e-tests.sh` with the appropriate `--platform` flag.

### Run a single flow

Pass the **flow name** (filename without `.yaml`) as a positional argument:

```bash
yarn test:e2e:ios CreateWallet
yarn test:e2e:ios ImportWallet
yarn test:e2e:ios SendClassicToken
yarn test:e2e:ios SwapClassicToken
```

```bash
yarn test:e2e:android CreateWallet
yarn test:e2e:android ImportWallet
# ... etc.
```

Or with explicit platform:

```bash
yarn test:e2e -- --platform ios CreateWallet
yarn test:e2e -- --platform android SwapClassicToken
```

Flow name matching is **case-insensitive**. The script runs only that flow and
writes artifacts to `e2e-artifacts/<FlowName>-<timestamp>/`.

## Flow vs. device

- **iOS**: Exactly one simulator must be **booted**; the script targets it via
  `simctl`.
- **Android**: Exactly one device/emulator must be **connected**; the script
  uses `adb`.
