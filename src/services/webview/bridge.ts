import {
  DAPP_APPROVAL_TIMEOUT_MS,
  WEBVIEW_BRIDGE_MAX_ENVELOPE_BYTES,
  WEBVIEW_BRIDGE_MAX_READY_PER_DOCUMENT,
  WEBVIEW_BRIDGE_MAX_REQUEST_ID_LENGTH,
  WEBVIEW_BRIDGE_MAX_SEEN_REQUESTS,
} from "config/constants";
import {
  DappApprovalKind,
  DappErrorCode,
  type DappRequest,
  DappTransport,
  WebviewBridgeEvent,
  WebviewBridgeMethod,
} from "config/dappRequest";
import { logger } from "config/logger";
import { validateWebviewSignMessage } from "helpers/walletKitValidation";
import {
  activateBridge,
  bridgeDelivery,
  WEBVIEW_BRIDGE_PROTOCOL,
  WEBVIEW_BRIDGE_PROTOCOL_VERSION,
} from "services/webview/injection";

/** The account context a connected document sees; never more than this. */
export interface BridgeAccount {
  address: string;
  chainId: string;
  networkPassphrase: string;
}

interface BridgeContext {
  /** False while the tab is hidden, the browser is backgrounded or Discovery is not focused. */
  active: boolean;
  /** Null when the wallet is locked or on an unsupported network. */
  account: BridgeAccount | null;
}

interface BridgeOptions {
  version: string;
  development: boolean;
  /** Runs a script in the WebView's main frame. */
  inject: (script: string) => void;
  context: () => BridgeContext;
  /** Resolves once the user approved the site or signed; rejects with a DappErrorCode. */
  approve: (kind: DappApprovalKind, request: DappRequest) => Promise<unknown>;
  /** Fresh per-document token; must be unguessable. */
  token: () => string;
  onInvalidated?: () => void;
}

/** Development-only HTTP hosts (simulator, emulator, loopback). */
const DEVELOPMENT_HTTP_HOSTS = ["localhost", "127.0.0.1", "10.0.2.2", "[::1]"];
const METHODS = new Set<string>(Object.values(WebviewBridgeMethod));
const error = (code: DappErrorCode, message: string) => ({ code, message });
const sameAccount = (a: BridgeAccount | null, b: BridgeAccount | null) =>
  a?.address === b?.address &&
  a?.chainId === b?.chainId &&
  a?.networkPassphrase === b?.networkPassphrase;

/**
 * Origin a document may hold wallet access under, or null. Production is
 * HTTPS only; development builds also allow HTTP on local hosts. URLs with
 * credentials are refused outright.
 */
export const walletOrigin = (
  url: string,
  development: boolean,
): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return null;
    if (parsed.protocol === "https:") return parsed.origin;
    if (
      development &&
      parsed.protocol === "http:" &&
      DEVELOPMENT_HTTP_HOSTS.includes(parsed.hostname)
    )
      return parsed.origin;
  } catch {
    /* Invalid and opaque URLs have no wallet access. */
  }
  return null;
};

/**
 * Native side of the in-app dApp bridge for one mounted WebView.
 *
 * Every message from the page is untrusted: a request is accepted only for
 * the activated document (native origin and per-document token), once per
 * id, for a known method with object params, and only while the browser is
 * active and the wallet unlocked. Approval and signing stay in
 * WalletKitProvider; this class only correlates requests with responses.
 * A controller belongs to exactly one mounted WebView, never the active-tab
 * ref.
 */
export class WebviewBridge {
  private origin: string | null = null;

  private documentToken = "";

  /** Main-frame URL the WebView reported on its last navigation; the only URL activation trusts. */
  private navigationUrl = "";

  private connected = false;

  private wantsConnection = false;

  private approvedSite = false;

  private revision = 0;

  private seen = new Set<string>();

  private readyCount = 0;

  private pending = new Map<string, () => void>();

  private lastAccount: BridgeAccount | null = null;

  constructor(private options: BridgeOptions) {
    this.lastAccount = options.context().account;
  }

  private send(data: Record<string, unknown>) {
    if (!this.origin || !this.documentToken) {
      logger.warn("WebViewBridge", "send dropped: no active document", {
        origin: this.origin,
        hasToken: Boolean(this.documentToken),
        keys: Object.keys(data),
      });
      return;
    }
    this.options.inject(
      bridgeDelivery(this.documentToken, this.origin, {
        protocol: WEBVIEW_BRIDGE_PROTOCOL,
        version: WEBVIEW_BRIDGE_PROTOCOL_VERSION,
        documentToken: this.documentToken,
        ...data,
      }),
    );
  }

  /**
   * Cancels every pending request and tells a connected document its wallet
   * context changed. Called on navigation, account/network change, lock,
   * backgrounding and disconnect.
   */
  invalidate() {
    this.revision += 1;
    this.pending.forEach((cancel) => cancel());
    this.pending.clear();
    if (this.connected)
      this.send({
        event: WebviewBridgeEvent.DISCONNECT,
        data: error(DappErrorCode.CONTEXT_CHANGED, "Wallet context changed"),
      });
    this.connected = false;
    this.options.onInvalidated?.();
  }

  /**
   * The WebView started loading a new main-frame document. `url` is the
   * navigation URL the WebView reported; it is the only URL later activation
   * trusts.
   */
  navigationStarted(url = "") {
    this.navigationUrl = url;
    this.invalidate();
    this.origin = null;
    this.documentToken = "";
    this.readyCount = 0;
    this.approvedSite = false;
    this.wantsConnection = false;
    this.seen.clear();
  }

  /**
   * Activates the document at `url` (main-frame URL from the WebView) with a
   * fresh token, or tears the bridge down when the origin is not one the
   * wallet serves. Idempotent for the same origin.
   */
  loaded(url: string) {
    const origin = walletOrigin(url, this.options.development);
    if (!origin) {
      this.navigationStarted();
      return;
    }
    if (!this.documentToken || origin !== this.origin) {
      if (this.documentToken) this.navigationStarted(url);
      this.navigationUrl = url;
      this.origin = origin;
      this.documentToken = this.options.token();
    }
    this.options.inject(
      activateBridge(this.options.version, this.documentToken, origin),
    );
  }

  /**
   * Wallet or browser context changed (account, network, lock, focus, tab).
   * Invalidates pending work and, for a connected document that is active
   * again, pushes the current account.
   */
  contextChanged() {
    const { account, active } = this.options.context();
    const changed = !sameAccount(account, this.lastAccount);
    const wasConnected = this.connected;
    if (!active || changed) this.invalidate();
    if (active && account && this.approvedSite && this.wantsConnection) {
      this.connected = true;
      if (changed || !wasConnected) {
        this.send({
          event: WebviewBridgeEvent.ACCOUNTS_CHANGED,
          data: account,
        });
        this.send({ event: WebviewBridgeEvent.CHAIN_CHANGED, data: account });
      }
    }
    this.lastAccount = account;
  }

  /**
   * Handles one `onMessage` payload from the WebView. `frameUrl` is the URL
   * the WebView attached natively; the payload itself carries no authority.
   */
  async receive(raw: string, frameUrl: string): Promise<void> {
    if (Buffer.byteLength(raw, "utf8") > WEBVIEW_BRIDGE_MAX_ENVELOPE_BYTES)
      return;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      // Untrusted page input: malformed JSON is dropped, not logged, so a page
      // cannot flood breadcrumbs.
      return;
    }
    if (!value || typeof value !== "object") return;
    const message = value as Record<string, unknown>;
    if (message.protocol !== WEBVIEW_BRIDGE_PROTOCOL) return;
    // The bootstrap announces itself at document start and DOMContentLoaded,
    // so activation does not wait for onLoadEnd (every subresource). Neither
    // the payload nor the reporting frame has authority: activation uses the
    // main-frame URL the WebView reported on navigation, capped per document
    // (load end re-activates anyway).
    if (message.ready === true) {
      if (
        this.readyCount >= WEBVIEW_BRIDGE_MAX_READY_PER_DOCUMENT ||
        !this.navigationUrl
      )
        return;
      this.readyCount += 1;
      this.loaded(this.navigationUrl);
      return;
    }
    // The document token authenticates the sender: it is delivered only into
    // the main-frame document, which the same-origin policy keeps from
    // cross-origin iframes. The reported frame URL is a consistency check on
    // top.
    if (
      !this.origin ||
      walletOrigin(frameUrl, this.options.development) !== this.origin ||
      message.documentToken !== this.documentToken
    ) {
      logger.warn("WebViewBridge", "request dropped: not the active document", {
        frameUrl,
        method: message.method,
      });
      return;
    }
    if (
      typeof message.id !== "string" ||
      !message.id ||
      message.id.length > WEBVIEW_BRIDGE_MAX_REQUEST_ID_LENGTH
    )
      return;
    const { id } = message;
    const reply = (data: Record<string, unknown>) => this.send({ id, ...data });
    // Never settle an existing request with a duplicate's response.
    if (this.seen.has(id)) return;
    if (this.seen.size >= WEBVIEW_BRIDGE_MAX_SEEN_REQUESTS) {
      reply({
        error: error(DappErrorCode.BUSY, "Reload this document to continue"),
      });
      return;
    }
    this.seen.add(id);
    if (message.version !== WEBVIEW_BRIDGE_PROTOCOL_VERSION) {
      reply({
        error: error(
          DappErrorCode.UNSUPPORTED_VERSION,
          "Unsupported bridge version",
        ),
      });
      return;
    }
    if (typeof message.method !== "string" || !METHODS.has(message.method)) {
      reply({
        error: error(DappErrorCode.UNSUPPORTED_METHOD, "Unsupported method"),
      });
      return;
    }
    const method = message.method as WebviewBridgeMethod;
    if (
      !message.params ||
      typeof message.params !== "object" ||
      Array.isArray(message.params)
    ) {
      reply({
        error: error(DappErrorCode.INVALID_PARAMS, "Invalid parameters"),
      });
      return;
    }
    const params = message.params as Record<string, unknown>;
    if (
      method === WebviewBridgeMethod.SIGN_MESSAGE &&
      !validateWebviewSignMessage(params.message).valid
    ) {
      reply({
        error: error(
          DappErrorCode.INVALID_PARAMS,
          "Message must be a non-empty string of at most 1 KiB",
        ),
      });
      return;
    }
    const { account, active } = this.options.context();
    if (!active) {
      reply({
        error: error(DappErrorCode.CONTEXT_CHANGED, "Browser is inactive"),
      });
      return;
    }
    if (method === WebviewBridgeMethod.GET_CAPABILITIES) {
      reply({ result: { protocolVersion: WEBVIEW_BRIDGE_PROTOCOL_VERSION } });
      return;
    }
    if (!account) {
      reply({
        error: error(DappErrorCode.WALLET_LOCKED, "Wallet is locked"),
      });
      return;
    }
    if (method === WebviewBridgeMethod.DISCONNECT) {
      reply({ result: true });
      this.wantsConnection = false;
      this.invalidate();
      this.approvedSite = false;
      return;
    }
    const { revision } = this;
    const token = this.documentToken;
    const isValid = () =>
      revision === this.revision &&
      token === this.documentToken &&
      this.options.context().active &&
      sameAccount(account, this.options.context().account);
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (data: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      this.pending.delete(id);
      if (token === this.documentToken) reply(data);
      this.options.onInvalidated?.();
    };
    timer = setTimeout(
      () =>
        finish({
          error: error(
            DappErrorCode.TIMEOUT,
            "Request timed out; submission outcome may be unknown",
          ),
        }),
      DAPP_APPROVAL_TIMEOUT_MS,
    );
    this.pending.set(id, () =>
      finish({
        error: error(
          DappErrorCode.CONTEXT_CHANGED,
          "Wallet context changed; submission outcome may be unknown",
        ),
      }),
    );
    const request: DappRequest = {
      id,
      transport: DappTransport.WEBVIEW,
      origin: this.origin,
      metadata: {
        name: this.origin,
        description: "",
        url: this.origin,
        icons: [`${this.origin}/favicon.ico`],
      },
      params: {
        chainId: typeof params.chainId === "string" ? params.chainId : "",
        request: { method, params },
      },
      isValid: () => !settled && isValid(),
      respond: (response) => {
        finish(
          response.error
            ? { error: response.error }
            : { result: response.result },
        );
        return Promise.resolve();
      },
    };
    try {
      if (method === WebviewBridgeMethod.CONNECT) {
        if (!this.approvedSite)
          await this.options.approve(DappApprovalKind.SITE, request);
        if (!request.isValid()) return;
        this.approvedSite = true;
        this.wantsConnection = true;
        this.connected = true;
        this.lastAccount = account;
        finish({ result: account });
      } else if (method === WebviewBridgeMethod.GET_ACCOUNT) {
        finish(
          this.connected
            ? { result: account }
            : {
                error: error(DappErrorCode.NOT_CONNECTED, "Call connect first"),
              },
        );
      } else if (!this.connected) {
        finish({
          error: error(DappErrorCode.NOT_CONNECTED, "Call connect first"),
        });
      } else if (params.chainId !== account.chainId) {
        finish({
          error: error(
            DappErrorCode.WRONG_NETWORK,
            "Request network does not match wallet",
          ),
        });
      } else {
        await this.options.approve(DappApprovalKind.SIGN, request);
      }
    } catch (cause) {
      logger.warn("WebViewBridge", "approval threw", { id, cause });
      const failure =
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        "message" in cause
          ? { code: String(cause.code), message: String(cause.message) }
          : error(DappErrorCode.USER_REJECTED, "Request failed");
      finish({ error: failure });
    }
  }
}
