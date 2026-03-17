# Freighter Mobile — WalletConnect RPC Methods

This document describes the four Stellar WalletConnect RPC methods supported by
Freighter Mobile. Use it as a reference when integrating your dApp with
Freighter via the [WalletConnect v2](https://docs.walletconnect.com/) protocol.

---

## Overview

Freighter Mobile implements the `stellar` WalletConnect namespace. All four
methods follow the standard
[JSON-RPC 2.0](https://www.jsonrpc.org/specification) request/response format
and are sent over a WalletConnect session established on one of the supported
chains.

### Supported chains

| Network          | Chain ID          |
| ---------------- | ----------------- |
| Mainnet (Public) | `stellar:pubnet`  |
| Testnet          | `stellar:testnet` |

### Session proposal

When proposing a session, include the desired chain(s) in the
`requiredNamespaces` or `optionalNamespaces`:

```json
{
  "requiredNamespaces": {
    "stellar": {
      "chains": ["stellar:pubnet"],
      "methods": [
        "stellar_signXDR",
        "stellar_signAndSubmitXDR",
        "stellar_signMessage",
        "stellar_signAuthEntry"
      ],
      "events": ["stellar_accountsChanged"]
    }
  }
}
```

---

## Methods

### `stellar_signXDR`

Signs a Stellar transaction and returns the signed XDR. The transaction is
**not** submitted to the network — your dApp is responsible for submission.

**Request params**

```json
{
  "xdr": "<base64-encoded transaction XDR>"
}
```

| Field | Type     | Description                                                               |
| ----- | -------- | ------------------------------------------------------------------------- |
| `xdr` | `string` | Base64-encoded `TransactionEnvelope` or `FeeBumpTransactionEnvelope` XDR. |

**Response**

```json
{
  "signedXDR": "<base64-encoded signed transaction XDR>"
}
```

**Full WalletConnect request example**

```json
{
  "id": 1234567890,
  "jsonrpc": "2.0",
  "method": "stellar_signXDR",
  "params": {
    "request": {
      "method": "stellar_signXDR",
      "params": {
        "xdr": "AAAAAgAAAAA..."
      }
    },
    "chainId": "stellar:pubnet"
  }
}
```

**Error cases**

| Condition            | Error message                                |
| -------------------- | -------------------------------------------- |
| Chain not supported  | `"Unsupported chain: <chainId>"`             |
| Wrong active network | `"Please switch to <network> and try again"` |
| XDR parse failure    | `"Failed to sign transaction"`               |
| User rejected        | `"User rejected the request"`                |

---

### `stellar_signAndSubmitXDR`

Signs a Stellar transaction and submits it to the Stellar network (Horizon).
Returns a success status when both signing and submission succeed.

**Request params**

```json
{
  "xdr": "<base64-encoded transaction XDR>"
}
```

| Field | Type     | Description                                                               |
| ----- | -------- | ------------------------------------------------------------------------- |
| `xdr` | `string` | Base64-encoded `TransactionEnvelope` or `FeeBumpTransactionEnvelope` XDR. |

**Response**

```json
{
  "status": "success"
}
```

**Full WalletConnect request example**

```json
{
  "id": 1234567890,
  "jsonrpc": "2.0",
  "method": "stellar_signAndSubmitXDR",
  "params": {
    "request": {
      "method": "stellar_signAndSubmitXDR",
      "params": {
        "xdr": "AAAAAgAAAAA..."
      }
    },
    "chainId": "stellar:pubnet"
  }
}
```

**Error cases**

| Condition                  | Error message                                |
| -------------------------- | -------------------------------------------- |
| Chain not supported        | `"Unsupported chain: <chainId>"`             |
| Wrong active network       | `"Please switch to <network> and try again"` |
| XDR parse / sign failure   | `"Failed to sign transaction"`               |
| Horizon submission failure | `"Failed to submit transaction"`             |
| User rejected              | `"User rejected the request"`                |

---

### `stellar_signMessage`

Signs an arbitrary UTF-8 text message with the wallet's active key. Follows
[SEP-53](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md)
byte-length limits.

**Request params**

```json
{
  "message": "Hello from my dApp"
}
```

| Field     | Type     | Constraints                   | Description                    |
| --------- | -------- | ----------------------------- | ------------------------------ |
| `message` | `string` | Non-empty, ≤ 1024 UTF-8 bytes | The plaintext message to sign. |

**Response**

```json
{
  "signature": "<base64-encoded Ed25519 signature>"
}
```

The signature covers the message bytes as defined by SEP-53.

**Full WalletConnect request example**

```json
{
  "id": 1234567890,
  "jsonrpc": "2.0",
  "method": "stellar_signMessage",
  "params": {
    "request": {
      "method": "stellar_signMessage",
      "params": {
        "message": "Please sign this message to verify ownership"
      }
    },
    "chainId": "stellar:pubnet"
  }
}
```

**Error cases**

| Condition                     | Error message                  |
| ----------------------------- | ------------------------------ |
| Missing or non-string message | `"Invalid message"`            |
| Empty message                 | `"Cannot sign empty message"`  |
| Message exceeds 1 KB          | `"Message too long (max 1KB)"` |
| Signing failed                | `"Failed to sign message"`     |
| User rejected                 | `"User rejected the request"`  |

---

### `stellar_signAuthEntry`

Signs a
[Soroban authorization entry](https://developers.stellar.org/docs/smart-contracts/guides/auth/authorization)
(`SorobanAuthorizationEntry`) and returns the signed entry XDR. Used in
multi-auth and custom-account smart contract workflows where the wallet must
co-sign a specific contract invocation without submitting a transaction.

> **Security note:** Authorization entries are not automatically scanned for
> security risks (Blockaid scanning is not available for this method). Review
> the entry's contract address, function name, and subinvocations before
> signing.

**Request params**

```json
{
  "entryXdr": "<base64-encoded SorobanAuthorizationEntry XDR>"
}
```

| Field      | Type     | Constraints                                                               | Description                                                                                                                  |
| ---------- | -------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `entryXdr` | `string` | Non-empty, non-whitespace, ≤ 64 KB, `sorobanCredentialsAddress` type only | Base64-encoded `SorobanAuthorizationEntry` XDR. The entry's `credentials.address` must match the wallet's active public key. |

**Response**

```json
{
  "signedAuthEntry": "<base64-encoded signed SorobanAuthorizationEntry XDR>"
}
```

The returned XDR is the same `SorobanAuthorizationEntry` with the
`credentials.signature` field populated as an `ScVal` map containing
`public_key` (bytes) and `signature` (bytes), following the standard Soroban
account auth verification interface.

**Full WalletConnect request example**

```json
{
  "id": 1234567890,
  "jsonrpc": "2.0",
  "method": "stellar_signAuthEntry",
  "params": {
    "request": {
      "method": "stellar_signAuthEntry",
      "params": {
        "entryXdr": "AAAAAQ..."
      }
    },
    "chainId": "stellar:pubnet"
  }
}
```

**Building the `entryXdr` on your dApp**

```typescript
import { xdr, Networks, hash } from "@stellar/stellar-sdk";

// Obtain the SorobanAuthorizationEntry from your contract simulation
const simulationResult = await server.simulateTransaction(tx);
const authEntries = simulationResult.result.auth;

// Encode the entry that needs the wallet signature
const entryXdr = authEntries[0].toXDR("base64");

// Send via WalletConnect
const result = await walletKit.request({
  topic: session.topic,
  chainId: "stellar:pubnet",
  request: {
    method: "stellar_signAuthEntry",
    params: { entryXdr },
  },
});

// result.signedAuthEntry is the base64 signed entry
// Attach it back to your transaction auth array before submission
```

**Error cases**

| Condition                                          | Error message                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| Missing, non-string, or whitespace-only `entryXdr` | `"Invalid authorization entry"`                                         |
| `entryXdr` exceeds 64 KB                           | `"Auth entry exceeds maximum allowed size"`                             |
| Entry address does not match signer                | `"signAuthEntry: entry address does not match signer"`                  |
| Non-address credentials type                       | `"signAuthEntry: only sorobanCredentialsAddress entries are supported"` |
| XDR parse failure                                  | `"Failed to process auth entry"`                                        |
| User rejected                                      | `"User rejected the request"`                                           |

---

## Common patterns

### Handling errors

All error responses follow the JSON-RPC 2.0 error format with code `5000`:

```json
{
  "id": 1234567890,
  "jsonrpc": "2.0",
  "error": {
    "code": 5000,
    "message": "User rejected the request"
  }
}
```

### Network handling

Freighter Mobile validates that the chain ID in the request matches the wallet's
currently active network. If the user is on the wrong network, the request is
rejected with a descriptive error. Always specify `chainId` in your request
params.

### User confirmation flow

All four methods trigger a native bottom sheet in Freighter Mobile for the user
to review and confirm (or reject) the request. Blockaid security scanning is
performed for `stellar_signXDR` and `stellar_signAndSubmitXDR`. For
`stellar_signMessage` and `stellar_signAuthEntry`, no automated scan is
performed.

---

## See also

- [WalletConnect v2 Docs](https://docs.walletconnect.com/)
- [Stellar Developer Docs — Smart Contracts Auth](https://developers.stellar.org/docs/smart-contracts/guides/auth/authorization)
- [SEP-53: Stellar Sign Message](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md)
- [Freighter E2E WalletConnect Tests](../e2e/docs/walletconnect-e2e-testing.md)
