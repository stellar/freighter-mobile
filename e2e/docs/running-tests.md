# Running Tests

How to run E2E tests in CI, locally, and how to run a **single flow** by
platform and name.

## CI

Tests run automatically on triggers described in
[CI & Triggers](ci-and-triggers.md). Each matrix job runs exactly one flow (e.g.
`CreateWallet`) on Android or iOS. The project script `run-e2e-tests.sh` is
invoked with `--platform`, `--shard-index`, `--shard-total`, and the flow name.

### Flow retries (`E2E_FLOW_ATTEMPTS`)

CI sets `E2E_FLOW_ATTEMPTS: "3"`, so a flow that fails gets up to two more
attempts on the same device before the job is reported red. This exists so a
flaky attempt does not require manually re-running the whole matrix job.

- Defaults to `1` when unset, so **local runs still fail fast** and real
  breakage surfaces immediately. Set it locally to reproduce CI behaviour:
  `E2E_FLOW_ATTEMPTS=3 yarn test:e2e:android ForgotPasswordWarning`.
- Retries are **not** silent: a flow that only passed on a retry is logged as
  `passed ... (on attempt N — flaky)` and listed under
  `⚠️  Flows that needed a retry:` in the run summary. A flow that fails every
  attempt is reported as failed, never as flaky.
- Each attempt writes its own artifact directory, so a passing retry never
  overwrites the failing attempt's video and `maestro.log` — see
  [Artifacts & Debugging](artifacts-and-debugging.md).
- Transaction flows are re-provisioned with a fresh testnet account between
  attempts, since the first attempt may have consumed the previous one.
- `device offline` (ADB) errors retry on a separate budget and do not consume a
  flow attempt — that is an infra hiccup, not a signal about the app.

## Local

### Prerequisites

- Maestro installed, `.env` configured (see
  [Local Setup & Env](local-setup-and-env.md)).
- App built and running in simulator (iOS) or emulator (Android).
- For iOS: `run-e2e-tests.sh` will set the simulator clipboard with
  `E2E_TEST_RECOVERY_PHRASE` (for ImportWallet) or
  `E2E_TEST_FUNDED_RECOVERY_PHRASE` (for ImportFundedWallet).

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
yarn test:e2e:ios SendClassicToken  # Send on testnet (0.000001 XLM)
yarn test:e2e:ios SwapClassicToken  # Swap on testnet (0.000001 XLM)
```

```bash
yarn test:e2e:android CreateWallet
yarn test:e2e:android ImportWallet
# ... etc.
```

Or with explicit platform:

```bash
yarn test:e2e -- --platform ios CreateWallet
yarn test:e2e -- --platform android SendClassicToken
```

Flow name matching is **case-insensitive**. The script runs only that flow and
writes artifacts to `e2e-artifacts/<FlowName>-<timestamp>/`.

## Flow vs. device

- **iOS**: Exactly one simulator must be **booted**; the script targets it via
  `simctl`.
- **Android**: Exactly one device/emulator must be **connected**; the script
  uses `adb`.
