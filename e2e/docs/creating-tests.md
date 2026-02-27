# Creating Tests

How to add new E2E flows: **Maestro YAML (API)** in the repo, **Maestro
Studio**, and **best practices**.

## Maestro YAML (API) in the codebase

Flows are YAML files under `e2e/flows/`. Structure:

```yaml
appId: org.stellar.freighterdev
tags:
  - feature-name
---
- launchApp:
    clearState: true
    clearKeychain: true
- assertVisible:
    id: some-screen
- tapOn:
    id: some-button
# ... more steps
```

- **Frontmatter**: `appId`, optional `tags`.
- **Commands**: List of Maestro commands. Use `id` (backed by `testID` in React
  Native) for stability.

Add new flows in the right folder (e.g. `flows/onboarding/`,
`flows/transactions/`), then:

1. Run locally: `yarn test:e2e:ios MyNewFlow` (or `android`).
2. Add a matrix entry in `android-e2e.yml` and `ios-e2e.yml` (new shard +
   `flow-name`), or document that the flow is run only locally/manually.

See [Maestro Commands](https://docs.maestro.dev/api-reference/commands) and
[Selectors](https://docs.maestro.dev/api-reference/selectors).

## Maestro Studio

**Studio** helps author flows by visually picking UI elements and getting YAML
snippets. Prefer **`id`** selectors (from `testID`) over raw text or coordinates
when you add them to flows.

There are two options. Use the comparison below to choose:

|                  | **Desktop app**                                                                              | **CLI / in-browser**                                          |
| ---------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **What it is**   | Standalone IDE: create, edit, and run flows                                                  | Element picker + REPL in browser (`maestro studio`)           |
| **Flow editing** | Built-in; edit YAML in the app                                                               | None; you edit flows in your editor and paste snippets        |
| **Run tests**    | Run locally from the UI                                                                      | You run `maestro test` (or `yarn test:e2e`) yourself          |
| **Env vars**     | Settings UI (e.g. `E2E_TEST_RECOVERY_PHRASE`, `E2E_TEST_FUNDED_RECOVERY_PHRASE`); one-by-one | No env config; use `-e` when running `maestro test`           |
| **CLI required** | No                                                                                           | Yes (Maestro CLI)                                             |
| **Best for**     | Inspecting, editing, creating flows; setting env vars; all-in-one workflow                   | Quick element discovery and REPL when you already use the CLI |

### Option 1: Maestro Studio Desktop (recommended)

Full IDE: create and edit flows, connect a device, run tests locally, and set
environment variables in the app. No CLI needed.

- **Download**: [Mac](https://studio.maestro.dev/MaestroStudio.dmg) ·
  [Windows](https://studio.maestro.dev/MaestroStudio.exe) ·
  [Linux](https://studio.maestro.dev/MaestroStudio.AppImage)
- **Docs**:
  [Maestro Studio Desktop](https://docs.maestro.dev/getting-started/maestro-studio-desktop)

1. Install the app, connect a simulator/emulator, and open your project (or
   `e2e/flows/`).
2. Create or edit flows in the UI. Use **Settings** to add env vars (e.g.
   `E2E_TEST_RECOVERY_PHRASE`, `E2E_TEST_FUNDED_RECOVERY_PHRASE`).
3. Run flows via **Run Locally** or **Run on Cloud**; save `.yaml` under
   `e2e/flows/` (e.g. `flows/onboarding/`, `flows/transactions/`).

### Option 2: Maestro Studio (CLI / in-browser)

Element picker + REPL only. You edit flow files in your own editor; Studio helps
discover selectors and try commands. No flow editing, project view, or env
configuration in the UI.

- **Docs**:
  [Maestro Studio (CLI)](https://docs.maestro.dev/getting-started/maestro-studio-cli)

1. Boot the app in a simulator/emulator.
2. Run:

   ```bash
   maestro studio
   ```

3. In the browser: click elements on the device screenshot to get YAML examples,
   or run commands in the REPL. Copy snippets and paste them into your `.yaml`
   flows under `e2e/flows/`.
4. Run tests via `yarn test:e2e` (or `maestro test`). Pass env vars with `-e` if
   needed; the script injects `E2E_TEST_RECOVERY_PHRASE` and
   `E2E_TEST_FUNDED_RECOVERY_PHRASE` when set in `.env`.

## Recording a flow run (video)

To produce an MP4 of a flow (for demos or debugging):

```bash
maestro record e2e/flows/onboarding/CreateWallet.yaml
# Or local-only rendering:
maestro record --local e2e/flows/onboarding/CreateWallet.yaml
```

This is **separate** from the `recording.mp4` saved per flow by
`run-e2e-tests.sh` in `e2e-artifacts/`.

## Best practices

1. **Prefer `testID` over text or coordinates**  
   Use `id: my-button` in flows and set `testID="my-button"` on the
   corresponding React Native component. IDs are stable across i18n and UI copy
   changes; text and `point:` break more often.

2. **Isolation**  
   Use `launchApp` with `clearState: true` and `clearKeychain: true` so each run
   starts from a clean app state.

3. **Waits**  
   Use `extendedWaitUntil` with a timeout for elements that appear after async
   work (e.g. account data). Plain `assertVisible` can flake if the UI isn't
   ready yet.

4. **Conditional steps**  
   Use `runFlow` with `when` (e.g. `platform: ios`, or `visible: ...`) for
   optional steps like biometrics or platform-specific prompts.

5. **Documentation**  
   Add brief comments in YAML for non-obvious steps, and update
   [Test Flows](../README.md#test-flows) (and CI matrix docs) when adding or
   changing flows.
