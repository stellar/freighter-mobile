# WalletConnect E2E Testing

How to run WalletConnect (WC) flows locally, what the mock dApp does, and how to
troubleshoot common issues.

## Overview

WalletConnect tests exercise the WC request/approve/reject flows using a local
mock dApp server. The app connects to the mock dApp via a WC URI and uses
Maestro flows under `e2e/flows/walletconnect/`.

## Prerequisites

- App built and running (iOS simulator or Android emulator).
- `.env` configured as described in
  [Local Setup & Environment](local-setup-and-env.md).
- Mock dApp running (see below).

## Start the mock dApp

From the **mobile** folder:

```bash
cd freighter-mobile
./e2e/scripts/start-mock-server.sh
```

This starts the mock dApp on `http://localhost:3001`.

To stop it:

```bash
cd freighter-mobile
./e2e/scripts/stop-mock-server.sh
```

## Run WalletConnect flows

Flows live under `e2e/flows/walletconnect/`. Run a single flow by name:

```bash
yarn test:e2e:ios WalletConnectConnect
```

```bash
yarn test:e2e:ios WalletConnectSignMessage
```

```bash
yarn test:e2e:ios WalletConnectSignXdr
```

Use Android similarly:

```bash
yarn test:e2e:android WalletConnectSignMessage
```

The flow name is **case-insensitive** and matches the YAML filename without the
`.yaml` extension. See [Running Tests](running-tests.md#run-a-single-flow) for
more examples.

## Mock dApp endpoints

The mock dApp provides a minimal API to create sessions, send requests, and poll
for responses:

- `POST /session` creates a WC session and returns `uri` and `deepLink`.
- `GET /session/:id` returns session status.
- `GET /session/:id/wait` waits for approval.
- `POST /session/:id/request/signMessage` sends `stellar_signMessage`.
- `POST /session/:id/request/signXDR` sends `stellar_signXDR`.
- `GET /session/:id/response` polls the latest response.
- `DELETE /session/:id` disconnects a session.
- `DELETE /sessions` disconnects all sessions.

## Troubleshooting

- If the app cannot connect to the mock dApp, verify the server is running on
  `localhost:3001` and no other process is using that port.
- If the WC approval sheet does not appear, confirm the app is on the home
  screen and no modal is blocking input.
- If a flow hangs on response polling, check the mock dApp logs and confirm the
  wallet approved the request.
- If a flow fails due to selectors, ensure the target UI has a stable `testID`
  and update the YAML selector to use `id:`.

## Related docs

- [Local Setup & Environment](local-setup-and-env.md)
- [Running Tests](running-tests.md)
- [Creating Tests](creating-tests.md)
