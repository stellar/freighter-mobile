# WalletConnect E2E Testing

This document explains how to add automated e2e tests for WalletConnect features
(stellar_signMessage, stellar_signXDR, etc.) using Maestro.

## Challenge

WalletConnect requires **two parties**: the mobile wallet (Freighter) and a
dApp. Standard e2e tests are self-contained, but WalletConnect tests need
external request initiation.

## Solutions

### Option 1: Mock WalletConnect Server (Recommended)

**Pros**:

- Full control over test scenarios
- Deterministic and repeatable
- No external dependencies
- Can test edge cases (network mismatch, large messages, etc.)

**Cons**:

- Requires building mock server infrastructure
- More setup complexity

**Implementation**:

1. **Create Mock Server** (`e2e/mock-dapp/`):

   - Node.js/TypeScript server that implements WalletConnect protocol
   - Uses `@walletconnect/sign-client` to simulate a dApp
   - Exposes HTTP endpoints Maestro can call to trigger actions
   - Runs locally during e2e tests

2. **Server API**:

   ```
   POST /session/create
   - Returns WalletConnect URI for connection

   POST /session/:id/request/signMessage
   - Sends stellar_signMessage request
   - Body: { message: "test message" }

   POST /session/:id/request/signTransaction
   - Sends stellar_signXDR request

   GET /session/:id/response
   - Returns wallet response (signature)
   ```

3. **Maestro Flow Integration**:

   ```yaml
   # Start mock server (in CI or locally)
   - runScript: ./e2e/scripts/start-mock-server.sh

   # Create session via HTTP
   - runScript: |
       const response = await fetch('http://localhost:3001/session/create');
       const { uri } = await response.json();
       output.wcUri = uri;

   # Use deep link to connect (no QR scanning)
   - openLink: ${output.wcUri}

   # Wait for connection confirmation
   - assertVisible: "Connection successful"

   # Trigger signMessage request via HTTP
   - runScript: |
       await fetch('http://localhost:3001/session/test/request/signMessage', {
         method: 'POST',
         body: JSON.stringify({ message: "Hello, Stellar!" })
       });

   # Verify message signing UI appears
   - assertVisible:
       id: sign-message-title
   # Rest of flow...
   ```

4. **CI Integration**:

   ```yaml
   # .github/workflows/ios-e2e.yml
   - name: Start WalletConnect Mock Server
     run: |
       cd e2e/mock-dapp
       npm install
       npm start &
       sleep 5  # Wait for server to start

   - name: Run WalletConnect E2E Tests
     run: |
       maestro test e2e/flows/walletconnect/SignMessage.yaml
   ```

### Option 2: Deep Link Injection (Simpler, Limited)

**Pros**:

- No external server needed
- Simpler implementation
- Works with `ios-prod` and real WalletConnect relay

**Cons**:

- Less control over test scenarios
- Requires pre-generated WC URIs
- Can't test dynamic edge cases
- Relies on external WC relay availability

**Implementation**:

1. **Pre-generate Test Sessions**:

   - Create WC sessions manually
   - Save URIs to environment variables
   - Use in Maestro flows

   ```yaml
   # .env
   E2E_WC_SIGN_MESSAGE_URI=wc:abc123...
   ```

2. **Maestro Flow**:

   ```yaml
   # Use deep link to connect
   - openLink: ${E2E_WC_SIGN_MESSAGE_URI}

   # Approve connection
   - tapOn:
       id: session-proposal-confirm-button

   # Wait for pre-configured request
   # (requires dApp to send request automatically)
   - extendedWaitUntil:
       visible:
         id: dapp-request-bottom-sheet
       timeout: 10000
   ```

3. **Limitations**:
   - Can't programmatically trigger requests
   - Sessions expire
   - Hard to test edge cases

### Option 3: Test Helper UI (E2E Mode Only)

**Pros**:

- No external dependencies
- Full control within app
- Can test all scenarios

**Cons**:

- Requires app code changes
- Test-specific UI code in production bundle (gated by `IS_E2E_TEST`)

**Implementation**:

1. **Add E2E WalletConnect Simulator** (only when `IS_E2E_TEST=true`):

   ```tsx
   // src/components/screens/E2EWalletConnectSimulator.tsx
   export const E2EWalletConnectSimulator = () => {
     if (!isE2ETest) return null;

     return (
       <View>
         <Button
           testID="e2e-wc-simulate-session"
           onPress={() => {
             // Simulate WalletConnect session creation
             const mockSession = createMockWCSession();
             useWalletKitStore.getState().setEvent({
               type: WalletKitEventTypes.SESSION_PROPOSAL,
               ...mockSession,
             });
           }}
         />

         <Button
           testID="e2e-wc-simulate-sign-message"
           onPress={() => {
             // Simulate stellar_signMessage request
             const mockRequest = createMockSignMessageRequest();
             useWalletKitStore.getState().setEvent({
               type: WalletKitEventTypes.SESSION_REQUEST,
               ...mockRequest,
             });
           }}
         />
       </View>
     );
   };
   ```

2. **Maestro Flow**:

   ```yaml
   # Navigate to E2E helper screen (hidden in normal mode)
   - tapOn:
       id: settings-tab
   - tapOn:
       id: e2e-helpers-row # Only visible when IS_E2E_TEST=true

   # Simulate session proposal
   - tapOn:
       id: e2e-wc-simulate-session

   # Approve
   - tapOn:
       id: session-proposal-confirm-button

   # Simulate sign message request
   - tapOn:
       id: e2e-wc-simulate-sign-message

   # Verify UI
   - assertVisible:
       id: sign-message-title
   # Rest of flow...
   ```

## Recommended Approach

**For comprehensive testing**: **Option 1 (Mock Server)**

- Best for CI/CD automation
- Full control over scenarios
- Professional e2e testing standard

**For quick validation**: **Option 3 (Test Helper UI)**

- Fastest to implement
- Good for initial testing
- Can upgrade to Option 1 later

**For production environment testing**: **Option 2 (Deep Links)**

- Tests against real WC infrastructure
- Limited scenario coverage
- Good for smoke tests

## Next Steps

1. **Choose approach** based on team priorities
2. **Implement mock server** (if Option 1) or **add E2E helpers** (if Option 3)
3. **Create Maestro flows** for:
   - ✅ Sign message (basic)
   - ⏳ Sign message (rejection)
   - ⏳ Sign message (network mismatch)
   - ⏳ Sign message (too long)
   - ⏳ Sign message (JSON formatting)
   - ⏳ Sign transaction (stellar_signXDR)
   - ⏳ Sign and submit (stellar_signAndSubmitXDR)
4. **Add to CI workflows** (android-e2e.yml, ios-e2e.yml)
5. **Update documentation** (README, test matrix)

## Mock Server Reference (Option 1)

If implementing Option 1, the mock server structure would be:

```
e2e/
├── mock-dapp/
│   ├── package.json
│   ├── src/
│   │   ├── server.ts           # Express server
│   │   ├── walletconnect.ts    # WC client wrapper
│   │   └── routes.ts           # API endpoints
│   ├── README.md
│   └── .env.example
├── scripts/
│   ├── start-mock-server.sh    # For CI
│   └── stop-mock-server.sh
└── flows/
    └── walletconnect/
        ├── SignMessage.yaml
        ├── SignMessageReject.yaml
        └── SignTransaction.yaml
```

## Testing Matrix

| Test Case                       | Method              | Network        | Scenario        | Priority |
| ------------------------------- | ------------------- | -------------- | --------------- | -------- |
| Sign message - approve          | stellar_signMessage | Testnet        | Basic flow      | P0       |
| Sign message - reject           | stellar_signMessage | Testnet        | User cancels    | P1       |
| Sign message - network mismatch | stellar_signMessage | Testnet/Public | Wrong network   | P1       |
| Sign message - too long         | stellar_signMessage | Testnet        | >1KB message    | P1       |
| Sign message - JSON             | stellar_signMessage | Testnet        | JSON formatting | P2       |
| Sign transaction                | stellar_signXDR     | Testnet        | Basic flow      | P2       |
| Session disconnect              | N/A                 | Testnet        | Disconnect flow | P2       |

## Timeline Estimate

- **Option 1 (Mock Server)**: 3-5 days (server + flows + CI)
- **Option 2 (Deep Links)**: 1-2 days (flows only, limited coverage)
- **Option 3 (Test Helper UI)**: 2-3 days (helpers + flows)

Choose based on test coverage needs and available time.
