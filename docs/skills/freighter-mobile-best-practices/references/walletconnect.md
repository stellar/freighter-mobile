# WalletConnect Integration

## Protocol

Freighter Mobile uses WalletConnect v2 for connecting to dApps on both iOS and
Android.

## Architecture

### Initialization

`useWalletKitInitialize.ts` creates the WalletKit instance when the app loads.
This must happen early in the app lifecycle.

### Event Management

`useWalletKitEventsManager.ts` registers listeners for WalletConnect events:

- `session_proposal` — A dApp wants to connect
- `session_request` — A connected dApp wants to sign/submit something
- `session_delete` — A session was disconnected

### Provider

`WalletKitProvider.tsx` orchestrates the WalletConnect flow:

- Handles incoming session proposals
- Routes session requests to the approval UI
- Manages the connection lifecycle

## Session Approval

`walletKitUtil.ts` > `approveSessionProposal()`:

1. Validates the requested chain (`stellar:pubnet` or `stellar:testnet`)
2. Builds WalletConnect namespaces with supported methods and events
3. Calls `walletKit.approveSession()` to finalize the connection

## Supported RPC Methods

| Method                     | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| `stellar_signXDR`          | Sign a transaction XDR (does not submit)     |
| `stellar_signAndSubmitXDR` | Sign and submit a transaction to the network |
| `stellar_signMessage`      | Sign an arbitrary text message               |
| `stellar_signAuthEntry`    | Sign a Soroban authorization entry           |

Full RPC specification is documented in `docs/walletconnect-rpc-methods.md`.

## Request Handling

`walletKitUtil.ts` > `approveSessionRequest()`:

1. Switch on the RPC method
2. Validate the request parameters
3. Sign the transaction/message/auth entry
4. Respond to the dApp via `walletKit.respondSessionRequest()`

## Validation

`walletKitValidation.ts` provides validation functions:

| Function                         | What It Validates                              |
| -------------------------------- | ---------------------------------------------- |
| `validateSignMessageContent()`   | Message content is safe and well-formed        |
| `validateSignMessageLength()`    | Message does not exceed size limits            |
| `validateSignAuthEntryContent()` | Auth entry XDR is a non-empty string           |
| `validateSignAuthEntry()`        | Auth entry structure and network validity      |
| `validateAuthEntryNetwork()`     | Auth entry targets the correct Stellar network |

## Anti-Replay Protection

`hasRespondedRef` (a React ref) prevents duplicate responses to the same
WalletConnect request. Always check and set this ref before responding:

```tsx
if (hasRespondedRef.current) return;
hasRespondedRef.current = true;
await walletKit.respondSessionRequest({ ... });
```

## Session State

`useWalletKitStore` (`src/ducks/walletKit.ts`) manages WalletConnect sessions:

- `fetchActiveSessions()` — Retrieves all active dApp connections
- `disconnectSession(topic)` — Disconnects a specific session
- `disconnectAllSessions()` — Disconnects all active sessions

## Approval UI

`DappSignTransactionBottomSheetContent.tsx` displays the approval interface:

- dApp information (name, icon, URL)
- Transaction details (parsed from XDR)
- Blockaid security warnings (malicious, suspicious, benign, scan-failed)
- Approve / Reject buttons

## Transaction Details

The `useSignTransactionDetails` hook parses XDR for human-readable display,
showing operations, amounts, destinations, and other relevant transaction data.

## Blockaid Security Scanning

Every dApp transaction is scanned by Blockaid:

| Result        | Behavior                          |
| ------------- | --------------------------------- |
| `malicious`   | Show warning banner, user decides |
| `suspicious`  | Show warning banner, user decides |
| `benign`      | Process normally, no warnings     |
| `scan-failed` | Show warning banner, user decides |

## Mock dApp

The `mock-dapp/` directory contains a local WalletConnect testing dApp. Use it
to test WalletConnect flows without needing an external dApp.

## Key Security Considerations

- Never trust dApp display names or icons for security decisions (they can be
  spoofed)
- Always validate the chain matches the active Stellar network
- Always validate XDR content before signing
- Use `hasRespondedRef` to prevent duplicate responses
