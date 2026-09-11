/** Where a dApp request arrived from; decides how the response travels back. */
export enum DappTransport {
  WALLET_CONNECT = "walletconnect",
  WEBVIEW = "webview",
}

/** What a native approval sheet is asking the user to approve. */
export enum DappApprovalKind {
  /** Blockaid site verdict before a document gets the account. */
  SITE = "site",
  /** A signing request (transaction, message or auth entry). */
  SIGN = "sign",
}

/**
 * Error codes returned to dApps. WalletConnect keeps its numeric JSON-RPC
 * code; the WebView bridge delivers these strings verbatim and the dApp SDK
 * exposes the same set.
 */
export enum DappErrorCode {
  UNAVAILABLE = "UNAVAILABLE",
  INVALID_PARAMS = "INVALID_PARAMS",
  UNSUPPORTED_METHOD = "UNSUPPORTED_METHOD",
  UNSUPPORTED_VERSION = "UNSUPPORTED_VERSION",
  WALLET_LOCKED = "WALLET_LOCKED",
  WRONG_NETWORK = "WRONG_NETWORK",
  USER_REJECTED = "USER_REJECTED",
  BUSY = "BUSY",
  CONTEXT_CHANGED = "CONTEXT_CHANGED",
  NOT_CONNECTED = "NOT_CONNECTED",
  TIMEOUT = "TIMEOUT",
}

/** Methods the in-app WebView bridge accepts; the `stellar_*` ones map onto StellarRpcMethods. */
export enum WebviewBridgeMethod {
  GET_CAPABILITIES = "freighter_getCapabilities",
  CONNECT = "freighter_connect",
  GET_ACCOUNT = "freighter_getAccount",
  DISCONNECT = "freighter_disconnect",
  SIGN_XDR = "stellar_signXDR",
  SIGN_AND_SUBMIT_XDR = "stellar_signAndSubmitXDR",
  SIGN_MESSAGE = "stellar_signMessage",
  SIGN_AUTH_ENTRY = "stellar_signAuthEntry",
}

/** Events the bridge pushes to a connected document. */
export enum WebviewBridgeEvent {
  ACCOUNTS_CHANGED = "accountsChanged",
  CHAIN_CHANGED = "chainChanged",
  DISCONNECT = "disconnect",
}

/** A native-verified dApp request, independent of its response transport. */
export interface DappRequest {
  id: number | string;
  params: {
    chainId: string;
    request: { method: string; params?: Record<string, unknown> };
  };
  /** Origin the wallet verified natively; never taken from the request payload. */
  origin: string;
  metadata: { name: string; description: string; url: string; icons: string[] };
  transport: DappTransport;
  /** False once navigation, tab, lock or account/network changes made the request stale. */
  isValid: () => boolean;
  respond: (response: {
    id: number | string;
    jsonrpc: string;
    result?: unknown;
    error?: { code: DappErrorCode | number; message: string };
  }) => Promise<void>;
}
