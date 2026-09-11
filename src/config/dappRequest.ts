/** Where a dApp request arrived from; decides how the response travels back. */
export enum DappTransport {
  WALLET_CONNECT = "walletconnect",
}

/**
 * Error codes attached to dApp rejections. WalletConnect keeps its numeric
 * JSON-RPC code on the wire; these name the reason for callers and tests.
 */
export enum DappErrorCode {
  INVALID_PARAMS = "INVALID_PARAMS",
  UNSUPPORTED_METHOD = "UNSUPPORTED_METHOD",
  WRONG_NETWORK = "WRONG_NETWORK",
  USER_REJECTED = "USER_REJECTED",
  CONTEXT_CHANGED = "CONTEXT_CHANGED",
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
