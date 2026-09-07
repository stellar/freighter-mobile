# Freighter WebView provider

Discovery exposes a wallet transport to top-level dApps through
`window.stellar`. dApps talk to it through the standalone
[`@xoxno/freighter-webview-provider`](https://github.com/XOXNO/freighter-webview-provider)
SDK; WalletConnect and extension integrations are unchanged.

Feature flags (remote config, on in dev, off in production):

- `webview_provider_enabled` — inject and activate the bridge.
- `webview_auto_signin_enabled` — countersign a SEP-10 challenge on connect.

## Native boundary

- No native patch. The per-document token is the frame authenticator: the
  bootstrap is injected main-frame only, and activation and every reply are
  delivered with `injectJavaScript`, which runs in the main frame. The token
  therefore exists only in the top-level document, which the same-origin policy
  keeps from cross-origin iframes; a same-origin iframe already shares the
  page's authority. Iframes can reach `ReactNativeWebView.postMessage` but
  cannot present a valid token.
- `services/webview/injection.ts` is the bootstrap injected before content
  loads. It is idempotent, never installs into an iframe, and only becomes
  usable once the controller activates the document with a fresh token.
- `services/webview/bridge.ts` is the per-WebView controller. It activates a
  document only from the main-frame URL the WebView reported on navigation
  (never a URL taken from a message), requires HTTPS (dev: local HTTP hosts),
  and accepts a request only when the document token matches, the reported frame
  URL is the activated origin, the id is new (replay set), the version and
  method are known, and params are an object. Message signing is capped at 1
  KiB, envelopes at 1 MiB, approvals at five minutes. Navigation, tab change,
  background, lock, leaving Discovery, or an account/network change cancels
  pending work with `CONTEXT_CHANGED`.
- `config/dappRequest.ts` holds the shared `DappRequest` shape and the
  `DappTransport`, `DappApprovalKind`, `DappErrorCode`, `WebviewBridgeMethod`
  and `WebviewBridgeEvent` enums; bridge limits live in `config/constants.ts`
  and the WebView message cap in `helpers/walletKitValidation.ts`.
- `hooks/useWebviewBridge.ts` owns controller lifetime and hands approvals to
  `WalletKitProvider` through `ducks/dappApproval`, the single approval surface
  shared with WalletConnect (`BUSY` while occupied).
- `helpers/walletKitUtil.ts#executeDappRequest` signs and submits for both
  transports and re-checks request validity right before signing.

## Connect and SEP-10

`connect()` scans the origin with Blockaid; safe sites connect silently, others
need the existing warning acknowledgment. When auto sign-in is on,
`services/webview/sep10.ts` reads the site's `/.well-known/stellar.toml`,
fetches a challenge from its `WEB_AUTH_ENDPOINT`, verifies it with
`WebAuth.readChallengeTx` against the TOML `SIGNING_KEY`, the page's exact host
as home domain (never a parent domain, so a stray subdomain cannot obtain a
session on its parent), `web_auth_domain` and the wallet's network, checks the
client account, and countersigns without a prompt. Any failure returns no `auth`
and the dApp asks for a signature normally. Challenges are never cached. A
challenge (sequence 0, manage-data only) skips the Blockaid transaction scan.

## Tests

`__tests__/services/webviewBridge.test.ts` runs the injected JavaScript in a VM
against the controller; `webviewSep10.test.ts` covers SEP-10 acceptance and
refusals; `providers/WalletKitWebview.test.tsx` and
`helpers/dappExecutor.test.ts` cover the approval provider and executor.
