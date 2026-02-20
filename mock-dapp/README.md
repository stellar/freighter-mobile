# WalletConnect Mock dApp Server

Mock WalletConnect dApp for automated e2e testing of Freighter Mobile.

## Purpose

This mock server simulates a dApp that initiates WalletConnect requests,
allowing Maestro e2e tests to automate:

- Session establishment
- Message signing (`stellar_signMessage`)
- Transaction signing (`stellar_signXDR`, `stellar_signAndSubmitXDR`)

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start

# Server runs on http://localhost:3001
```

## API Endpoints

### Create Session

```bash
POST http://localhost:3001/session/create

Response:
{
  "sessionId": "test-session-123",
  "uri": "wc:abc123@2?relay-protocol=irn&symKey=...",
  "deepLink": "freighterdev://wc?uri=wc:..."
}
```

Use the `uri` or `deepLink` in Maestro to establish connection.

### Send stellar_signMessage Request

```bash
POST http://localhost:3001/session/:sessionId/request/signMessage

Body:
{
  "message": "Hello, Stellar!",
  "network": "testnet"  # or "pubnet"
}

Response:
{
  "requestId": "req-456",
  "status": "pending"
}
```

### Get Response

```bash
GET http://localhost:3001/session/:sessionId/response

Response (when approved):
{
  "signature": "base64-signature-string",
  "signer": "GXXX...",
  "status": "approved"
}

Response (when rejected):
{
  "error": "User rejected",
  "status": "rejected"
}
```

## Usage in Maestro

```yaml
# Create session
- runScript: |
    const res = await fetch('http://localhost:3001/session/create', { method: 'POST' });
    const data = await res.json();
    output.wcDeepLink = data.deepLink;
    output.sessionId = data.sessionId;

# Connect via deep link
- openLink: ${output.wcDeepLink}

# Approve connection in app
- tapOn:
    id: session-proposal-confirm-button

# Trigger sign message request
- runScript: |
    await fetch(`http://localhost:3001/session/${output.sessionId}/request/signMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Hello, Stellar!", network: "testnet" })
    });

# Verify and approve in app
- assertVisible:
    id: sign-message-title
- tapOn:
    id: dapp-request-confirm-button

# Get response
- runScript: |
    const res = await fetch(`http://localhost:3001/session/${output.sessionId}/response`);
    const data = await res.json();
    output.signature = data.signature;
```

## Implementation Sketch

### package.json

```json
{
  "name": "@freighter/wc-mock-dapp",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "ts-node src/server.ts",
    "dev": "nodemon --exec ts-node src/server.ts"
  },
  "dependencies": {
    "@walletconnect/sign-client": "^2.17.2",
    "express": "^4.21.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/node": "^22.10.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.3",
    "nodemon": "^3.1.9"
  }
}
```

### src/server.ts (skeleton)

```typescript
import { SignClient } from "@walletconnect/sign-client";
import cors from "cors";
import express from "express";

const app = express();
app.use(cors());
app.use(express.json());

const sessions = new Map();
let signClient: SignClient;

// Initialize WalletConnect SignClient
async function init() {
  signClient = await SignClient.init({
    projectId: process.env.WALLET_KIT_PROJECT_ID || "YOUR_PROJECT_ID",
    metadata: {
      name: "Mock WalletConnect dApp",
      description: "E2E testing mock dApp",
      url: "http://localhost:3001",
      icons: ["https://example.com/icon.png"],
    },
  });

  console.log("✅ WalletConnect SignClient initialized");
}

// POST /session/create
app.post("/session/create", async (req, res) => {
  try {
    const { uri, approval } = await signClient.connect({
      requiredNamespaces: {
        stellar: {
          methods: [
            "stellar_signMessage",
            "stellar_signXDR",
            "stellar_signAndSubmitXDR",
          ],
          chains: ["stellar:testnet", "stellar:pubnet"],
          events: ["accountsChanged"],
        },
      },
    });

    const sessionId = `test-${Date.now()}`;
    const deepLink = `freighterdev://wc?uri=${encodeURIComponent(uri)}`;

    sessions.set(sessionId, { uri, approval, responses: [] });

    res.json({ sessionId, uri, deepLink });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /session/:id/request/signMessage
app.post("/session/:id/request/signMessage", async (req, res) => {
  try {
    const { id } = req.params;
    const { message, network = "testnet" } = req.body;
    const session = sessions.get(id);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const topic = (await session.approval()).topic;

    const result = await signClient.request({
      topic,
      chainId: `stellar:${network}`,
      request: {
        method: "stellar_signMessage",
        params: { message },
      },
    });

    session.responses.push({ type: "signMessage", result });

    res.json({ requestId: `req-${Date.now()}`, status: "pending" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /session/:id/response
app.get("/session/:id/response", (req, res) => {
  const session = sessions.get(req.params.id);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const lastResponse = session.responses[session.responses.length - 1];

  if (!lastResponse) {
    return res.json({ status: "pending" });
  }

  if (lastResponse.result.error) {
    return res.json({
      status: "rejected",
      error: lastResponse.result.error,
    });
  }

  return res.json({
    status: "approved",
    signature: lastResponse.result.signature,
    signer: lastResponse.result.signer,
  });
});

const PORT = process.env.PORT || 3001;

init().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Mock WC dApp server running on http://localhost:${PORT}`);
  });
});
```

## Environment Variables

Create `.env`:

```bash
# WalletConnect Project ID (same as mobile app uses for testing)
WALLET_KIT_PROJECT_ID=your-project-id

# Server port
PORT=3001
```

## Cleanup

```bash
# Stop all sessions
curl -X DELETE http://localhost:3001/session/all
```

## Notes

- This is a **test-only** server, not for production
- Sessions are stored in memory (lost on restart)
- No authentication/authorization (localhost only)
- For E2E automation only

## Next Steps

1. Implement full server (currently skeleton)
2. Add transaction signing endpoints
3. Add session management (list, disconnect)
4. Add test scenarios (network mismatch, large messages)
5. Integrate with Maestro flows
6. Add to CI pipeline
