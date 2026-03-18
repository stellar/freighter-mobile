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
      "events": ["accountsChanged"]
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

Signs a Soroban authorization entry **preimage** (`HashIdPreimage` XDR, envelope
type `envelopeTypeSorobanAuthorization`) and returns the raw Ed25519 signature.
This follows
[SEP-43](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0043.md):
the **dApp** constructs the preimage (network ID + nonce + expiry + invocation),
and the wallet hashes it (`SHA-256`) and signs the digest. Used in multi-auth
and custom-account smart contract workflows where the wallet must co-sign a
specific contract invocation without submitting a transaction.

> **Security note:** Freighter Mobile performs a **Blockaid site scan** before
> showing the signing sheet. Review the contract address, function name, and
> subinvocations displayed in the UI before confirming.

**Request params**

```json
{
  "entryXdr": "<base64-encoded HashIdPreimage XDR>"
}
```

| Field      | Type     | Constraints               | Description                                                                                                                                                              |
| ---------- | -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `entryXdr` | `string` | Non-empty, non-whitespace | Base64-encoded `HashIdPreimage` XDR (envelope type `envelopeTypeSorobanAuthorization`). Build this from the `SorobanAuthorizationEntry` returned by contract simulation. |

**Response**

```json
{
  "signedAuthEntry": "<base64-encoded raw Ed25519 signature>",
  "signerAddress": "<G... Stellar public key>"
}
```

| Field             | Description                                                                |
| ----------------- | -------------------------------------------------------------------------- |
| `signedAuthEntry` | Base64-encoded 64-byte Ed25519 signature over `SHA-256(preimage)`.         |
| `signerAddress`   | Stellar public key (G-address) of the account that produced the signature. |

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
import { xdr, Networks, hash, Keypair } from "@stellar/stellar-sdk";

// Obtain the SorobanAuthorizationEntry from your contract simulation
const simulationResult = await server.simulateTransaction(tx);
const authEntry = simulationResult.result.auth[0]; // SorobanAuthorizationEntry

// Build the HashIdPreimage — this is what the wallet will hash and sign
const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
  new xdr.HashIdPreimageSorobanAuthorization({
    networkId: hash(Buffer.from(Networks.PUBLIC)),
    nonce: authEntry.credentials().address().nonce(),
    signatureExpirationLedger: authEntry
      .credentials()
      .address()
      .signatureExpirationLedger(),
    invocation: authEntry.rootInvocation(),
  }),
);

const entryXdr = preimage.toXDR("base64");

// Send via WalletConnect
const result = await walletKit.request({
  topic: session.topic,
  chainId: "stellar:pubnet",
  request: {
    method: "stellar_signAuthEntry",
    params: { entryXdr },
  },
});

// result.signedAuthEntry — base64 raw Ed25519 signature (64 bytes)
// result.signerAddress  — G-address of the signer

// Attach the signature back to the auth entry before submission
const signerRawKey = Keypair.fromPublicKey(result.signerAddress).rawPublicKey();
const signatureScVal = xdr.ScVal.scvMap([
  new xdr.ScMapEntry({
    key: xdr.ScVal.scvSymbol("public_key"),
    val: xdr.ScVal.scvBytes(signerRawKey),
  }),
  new xdr.ScMapEntry({
    key: xdr.ScVal.scvSymbol("signature"),
    val: xdr.ScVal.scvBytes(Buffer.from(result.signedAuthEntry, "base64")),
  }),
]);
authEntry
  .credentials()
  .address()
  .signature(xdr.ScVal.scvVec([signatureScVal]));
```

**Error cases**

| Condition                                          | Error message                    |
| -------------------------------------------------- | -------------------------------- |
| Missing, non-string, or whitespace-only `entryXdr` | `"Invalid authorization entry"`  |
| XDR parse failure                                  | `"Failed to process auth entry"` |
| User rejected                                      | `"User rejected the request"`    |

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
to review and confirm (or reject) the request.

**Blockaid security scanning:**

- **Site scan**: Performed once during the WalletConnect session connection
  (before any signing requests). This protects users from connecting to
  malicious dApps.
- **Transaction scan**: Performed for `stellar_signXDR` and
  `stellar_signAndSubmitXDR` requests, analyzing the transaction XDR for
  potential risks.
- **No per-request scan**: For `stellar_signMessage` and
  `stellar_signAuthEntry`, no additional scan is performed at request time — the
  site was already scanned during connection. The auth entry structure itself is
  not scanned

---

## See also

- [WalletConnect v2 Docs](https://docs.walletconnect.com/)
- [Stellar Developer Docs — Smart Contracts Auth](https://developers.stellar.org/docs/smart-contracts/guides/auth/authorization)
- [SEP-53: Stellar Sign Message](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md)
- [Freighter E2E WalletConnect Tests](../e2e/docs/walletconnect-e2e-testing.md)
