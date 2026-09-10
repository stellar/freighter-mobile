/* eslint-disable no-underscore-dangle, no-script-url */
// Prettier sorts built-in test imports with absolute application imports.
/* eslint-disable import/order */
import {
  DappApprovalKind,
  DappErrorCode,
  DappRequest,
} from "config/dappRequest";
import { WebviewBridge, walletOrigin } from "services/webview/bridge";
import {
  activateBridge,
  bridgeBootstrap,
  bridgeDelivery,
} from "services/webview/injection";
import { TextEncoder } from "util";
import { createContext, runInContext } from "vm";

const ORIGIN = "https://example.org";
const ACCOUNT = {
  address: "GACCOUNT",
  chainId: "stellar:testnet",
  networkPassphrase: "Test SDF Network ; September 2015",
};
const page = () => {
  const window = { ReactNativeWebView: { postMessage: jest.fn() } } as any;
  window.top = window;
  const location = { origin: ORIGIN };
  const context = createContext({
    window,
    location,
    TextEncoder,
    setTimeout,
    clearTimeout,
  });
  const run = (script: string) => runInContext(script, context);
  return { window, location, run };
};
const setup = () => {
  const browser = page();
  const state: { active: boolean; account: typeof ACCOUNT | null } = {
    active: true,
    account: ACCOUNT,
  };
  const approve = jest
    .fn<Promise<unknown>, [DappApprovalKind, DappRequest]>()
    .mockResolvedValue(true);
  let generation = 0;
  const bridge = new WebviewBridge({
    version: "1",
    development: false,
    token: () => `token-${++generation}`,
    context: () => state,
    approve,
    inject: browser.run,
  });
  bridge.loaded(ORIGIN);
  const received: any[] = [];
  const receive = browser.window.__freighterReceive;
  browser.window.__freighterReceive = (value: unknown) => {
    received.push(value);
    receive(value);
  };
  const raw = (
    id: string,
    method = "freighter_connect",
    params = {},
    overrides = {},
  ) =>
    JSON.stringify({
      protocol: "freighter-webview",
      version: 1,
      id,
      documentToken: `token-${generation}`,
      method,
      params,
      ...overrides,
    });
  const send = (
    id: string,
    method = "freighter_connect",
    params = {},
    overrides = {},
  ) => bridge.receive(raw(id, method, params, overrides), ORIGIN);
  return { bridge, state, approve, received, raw, send, ...browser };
};

describe("native WebView request boundary", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([
    "http://example.org",
    "https://user:password@example.org",
    "file:///tmp/a",
    "data:text/html,hi",
    "javascript:alert(1)",
  ])("rejects unsafe origin %s", (url) => {
    expect(walletOrigin(url, false)).toBeNull();
  });
  it("restricts development HTTP to explicit local hosts", () => {
    expect(walletOrigin("http://localhost:3000/path", true)).toBe(
      "http://localhost:3000",
    );
    expect(walletOrigin("http://localhost.evil.org", true)).toBeNull();
    expect(walletOrigin("http://localhost:3000", false)).toBeNull();
  });
  it("ignores forged body origins, native origin mismatch, and old document tokens", async () => {
    const h = setup();
    await h.bridge.receive(
      h.raw("1", "freighter_connect", {}, { origin: ORIGIN }),
      "https://attacker.org",
    );
    await h.send("2", "freighter_connect", {}, { documentToken: "old" });
    expect(h.approve).not.toHaveBeenCalled();
    expect(h.received).toEqual([]);
  });
  it("holds account access behind site approval and caches only the current document", async () => {
    const h = setup();
    let allow!: () => void;
    h.approve.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          allow = resolve;
        }),
    );
    const pending = h.send("1");
    expect(h.received).toEqual([]);
    allow();
    await pending;
    expect(h.received[0].result).toEqual(ACCOUNT);
    await h.send("2");
    expect(h.approve).toHaveBeenCalledTimes(1);
    h.bridge.navigationStarted();
    h.bridge.loaded(ORIGIN);
    await h.send("3");
    expect(h.approve).toHaveBeenCalledTimes(2);
  });
  it("does not expose an account after a denied or failed site gate", async () => {
    const h = setup();
    h.approve.mockRejectedValue({
      code: DappErrorCode.USER_REJECTED,
      message: "Rejected",
    });
    await h.send("1");
    await h.send("2", "freighter_getAccount");
    expect(h.received.map((r) => r.error.code)).toEqual([
      "USER_REJECTED",
      "NOT_CONNECTED",
    ]);
    expect(h.received.every((r) => r.result === undefined)).toBe(true);
  });
  it.each(["navigation", "account", "inactive"])(
    "cancels a pending site scan on %s",
    async (change) => {
      const h = setup();
      let allow!: () => void;
      h.approve.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            allow = resolve;
          }),
      );
      const pending = h.send("1");
      const request = h.approve.mock.calls[0][1];
      if (change === "navigation") {
        h.bridge.navigationStarted();
        h.bridge.loaded("https://other.org");
      } else {
        if (change === "account")
          h.state.account = { ...ACCOUNT, address: "GOTHER" };
        else h.state.active = false;
        h.bridge.contextChanged();
      }
      expect(request.isValid()).toBe(false);
      allow();
      await pending;
      expect(h.received.some((r) => r.result?.address)).toBe(false);
    },
  );
  it("executes a duplicate signing ID at most once and ignores responses after cancellation", async () => {
    const h = setup();
    await h.send("connect");
    h.approve.mockImplementationOnce(() => Promise.resolve(undefined));
    await h.send("sign", "stellar_signMessage", {
      chainId: ACCOUNT.chainId,
      message: "hello",
    });
    const request = h.approve.mock.calls[1][1];
    await h.send("sign", "stellar_signMessage", {
      chainId: ACCOUNT.chainId,
      message: "different",
    });
    expect(h.approve).toHaveBeenCalledTimes(2);
    h.bridge.navigationStarted();
    h.bridge.loaded(ORIGIN);
    await request.respond({
      id: "sign",
      jsonrpc: "2.0",
      result: { signature: "secret" },
    });
    expect(h.received.some((r) => r.result?.signature)).toBe(false);
  });
  it("rejects inactive, locked, wrong-network and unsupported requests before approval", async () => {
    const h = setup();
    h.state.active = false;
    await h.send("1");
    h.state.active = true;
    h.state.account = null;
    await h.send("2");
    h.state.account = ACCOUNT;
    await h.send("3");
    await h.send("4", "stellar_signMessage", {
      chainId: "stellar:pubnet",
      message: "hello",
    });
    await h.send("5", "unknown");
    expect(h.approve).toHaveBeenCalledTimes(1);
    expect(h.received.filter((r) => r.error).map((r) => r.error.code)).toEqual([
      "CONTEXT_CHANGED",
      "WALLET_LOCKED",
      "WRONG_NETWORK",
      "UNSUPPORTED_METHOD",
    ]);
  });
  it("refreshes a connected hidden document when it becomes active", async () => {
    const h = setup();
    await h.send("connect");
    h.state.active = false;
    h.bridge.contextChanged();
    h.state.account = { ...ACCOUNT, address: "GOTHER" };
    h.bridge.contextChanged();
    const before = h.received.length;
    h.state.active = true;
    h.bridge.contextChanged();
    expect(
      h.received.slice(before).map((r) => [r.event, r.data.address]),
    ).toEqual([
      ["accountsChanged", "GOTHER"],
      ["chainChanged", "GOTHER"],
    ]);
    await h.send("account", "freighter_getAccount");
    expect(h.received.at(-1).result.address).toBe("GOTHER");
    expect(h.approve).toHaveBeenCalledTimes(1);
  });

  it("resolves disconnect before its event cancels pending page promises", async () => {
    const h = setup();
    await h.send("connect");
    h.window.ReactNativeWebView.postMessage.mockImplementation((raw: string) =>
      h.bridge.receive(raw, ORIGIN),
    );
    await expect(
      h.window.stellar.request({ method: "freighter_disconnect" }),
    ).resolves.toBe(true);
    h.state.active = false;
    h.bridge.contextChanged();
    h.state.active = true;
    h.bridge.contextChanged();
    await h.send("account", "freighter_getAccount");
    expect(h.received.at(-1).error.code).toBe("NOT_CONNECTED");
  });

  it.each([
    ["stellar_signXDR", { xdr: "transaction" }, { signedXDR: "signed" }],
    ["stellar_signAndSubmitXDR", { xdr: "transaction" }, { status: "success" }],
    ["stellar_signMessage", { message: "hello" }, { signature: "signed" }],
    [
      "stellar_signAuthEntry",
      { entryXdr: "auth" },
      { signedAuthEntry: "signed", signerAddress: "GACCOUNT" },
    ],
  ])(
    "routes %s through native approval with pinned context",
    async (method, params, result) => {
      const h = setup();
      await h.send("connect");
      h.approve.mockImplementationOnce(async (kind, request) => {
        expect(kind).toBe(DappApprovalKind.SIGN);
        expect(request.origin).toBe(ORIGIN);
        expect(request.isValid()).toBe(true);
        expect(request.params.request).toEqual({
          method,
          params: { ...params, chainId: ACCOUNT.chainId },
        });
        await request.respond({ id: request.id, jsonrpc: "2.0", result });
      });
      await h.send("sign", method, {
        ...(params as object),
        chainId: ACCOUNT.chainId,
      });
      expect(h.received.at(-1).result).toEqual(result);
    },
  );

  it("enforces exact UTF-8 message and envelope byte limits", async () => {
    const h = setup();
    await h.send("connect");
    h.approve.mockImplementation(() => Promise.resolve());
    await h.send("at-limit", "stellar_signMessage", {
      message: "🔥".repeat(256),
      chainId: ACCOUNT.chainId,
    });
    expect(h.approve).toHaveBeenCalledTimes(2);
    await h.send("over-limit", "stellar_signMessage", {
      message: `${"🔥".repeat(256)}a`,
      chainId: ACCOUNT.chainId,
    });
    expect(h.received.at(-1).error.code).toBe("INVALID_PARAMS");
    expect(h.approve).toHaveBeenCalledTimes(2);
    const base = h.raw("envelope", "freighter_getCapabilities", {
      padding: "",
    });
    const exact = h.raw("envelope", "freighter_getCapabilities", {
      padding: "a".repeat(1048576 - Buffer.byteLength(base)),
    });
    expect(Buffer.byteLength(exact)).toBe(1048576);
    await h.bridge.receive(`${exact} `, ORIGIN);
    expect(h.received.at(-1).id).toBe("over-limit");
    await h.bridge.receive(exact, ORIGIN);
    expect(h.received.at(-1).result).toEqual({ protocolVersion: 1 });
  });

  it("bounds envelope bytes and invalidates timed-out approval handles", async () => {
    const h = setup();
    await h.send("huge", "freighter_connect", { data: "🔥".repeat(270000) });
    expect(h.approve).not.toHaveBeenCalled();
    h.approve.mockImplementationOnce(() => Promise.resolve(undefined));
    await h.send("connect");
    h.approve.mockImplementationOnce(() => Promise.resolve(undefined));
    await h.send("sign", "stellar_signXDR", {
      chainId: ACCOUNT.chainId,
      xdr: "xdr",
    });
    const request = h.approve.mock.calls[1][1];
    jest.advanceTimersByTime(300000);
    expect(request.isValid()).toBe(false);
    expect(h.received.at(-1).error.code).toBe("TIMEOUT");
    await request.respond({ id: "sign", jsonrpc: "2.0", result: "late" });
    expect(h.received.at(-1).error.code).toBe("TIMEOUT");
  });
});

describe("injected JavaScript delivery", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("registers promises before synchronous native responses", async () => {
    const h = page();
    h.run(activateBridge("1", "token", ORIGIN));
    h.window.ReactNativeWebView.postMessage.mockImplementation(
      (raw: string) => {
        const request = JSON.parse(raw);
        h.run(bridgeDelivery("token", ORIGIN, { ...request, result: "ok" }));
      },
    );
    await expect(
      h.window.stellar.request({ method: "freighter_getCapabilities" }),
    ).resolves.toBe("ok");
  });
  it("drops cross-origin and stale-token responses, then accepts the originating document", async () => {
    const h = page();
    h.run(activateBridge("1", "token", ORIGIN));
    const promise = h.window.stellar.request({ method: "freighter_connect" });
    const request = JSON.parse(
      h.window.ReactNativeWebView.postMessage.mock.calls.at(-1)[0],
    );
    const delivery = { ...request, result: "account" };
    h.run(
      bridgeDelivery("old", ORIGIN, {
        ...delivery,
        result: "leaked-old-document",
      }),
    );
    h.location.origin = "https://other.org";
    h.run(
      bridgeDelivery("token", ORIGIN, {
        ...delivery,
        result: "leaked-other-origin",
      }),
    );
    h.location.origin = ORIGIN;
    h.run(bridgeDelivery("token", ORIGIN, delivery));
    await expect(promise).resolves.toBe("account");
  });
  it("keeps bootstrap idempotent and rejects pending work when document token changes", async () => {
    const h = page();
    h.run(activateBridge("1", "first", ORIGIN));
    const provider = h.window.stellar;
    h.run(bridgeBootstrap("1"));
    expect(h.window.stellar).toBe(provider);
    const promise = h.window.stellar.request({ method: "stellar_signXDR" });
    h.run(activateBridge("1", "second", ORIGIN));
    await expect(promise).rejects.toMatchObject({ code: "CONTEXT_CHANGED" });
  });
  const readyPage = () => {
    const h = page();
    h.run(bridgeBootstrap("1"));
    const ready = h.window.ReactNativeWebView.postMessage.mock.calls[0][0];
    const inject = jest.fn(h.run);
    const bridge = new WebviewBridge({
      version: "1",
      development: false,
      token: () => "token-1",
      context: () => ({ active: true, account: ACCOUNT }),
      approve: jest.fn(),
      inject,
    });
    return { ...h, ready, inject, bridge };
  };
  it("announces readiness at document start so activation does not wait for load end", async () => {
    const h = readyPage();
    expect(JSON.parse(h.ready)).toEqual({
      protocol: "freighter-webview",
      version: 1,
      ready: true,
    });
    h.bridge.navigationStarted(`${ORIGIN}/app`);
    await h.bridge.receive(h.ready, ORIGIN);
    expect(h.window.stellar.documentToken).toBe("token-1");
    expect(h.window.stellar.protocolVersion).toBe(1);
    // Same-origin repeats keep the token; anything past the second is ignored.
    await h.bridge.receive(h.ready, ORIGIN);
    await h.bridge.receive(h.ready, ORIGIN);
    expect(h.window.stellar.documentToken).toBe("token-1");
    expect(h.inject).toHaveBeenCalledTimes(2);
  });
  it("activates only the navigated main-frame URL, whatever frame reports readiness", async () => {
    const h = readyPage();
    // No navigation known yet: nothing to activate.
    await h.bridge.receive(h.ready, ORIGIN);
    expect(h.inject).not.toHaveBeenCalled();
    // A third-party iframe cannot steer activation to its own origin...
    h.bridge.navigationStarted(`${ORIGIN}/app`);
    await h.bridge.receive(h.ready, "https://attacker.org/frame");
    expect(h.inject).toHaveBeenCalledTimes(1);
    expect(h.window.stellar.documentToken).toBe("token-1");
    // ...and a navigation the wallet does not serve never activates.
    h.bridge.navigationStarted("http://attacker.example");
    await h.bridge.receive(h.ready, ORIGIN);
    expect(h.inject).toHaveBeenCalledTimes(1);
  });
  it("does not install into an iframe", () => {
    const h = page();
    h.window.top = {};
    h.run(bridgeBootstrap("1"));
    expect(h.window.stellar).toBeUndefined();
  });
});
