/**
 * XMLHttpRequest Polyfill Tests
 *
 * Verifies the two RN/Stellar-SDK compatibility patches in src/polyfills/xhr.ts:
 *  - URLSearchParams request bodies are stringified before send (RN's XHR can't
 *    serialize the object, which made SDK v16 form-urlencoded submits go out
 *    empty → Horizon transaction_malformed).
 *  - the exported normalizeXhrRequestBody helper.
 *
 * A stub XMLHttpRequest is installed so the test exercises the patch regardless
 * of the jest environment's XHR.
 */
type SendArg = unknown;

describe("xhr polyfill", () => {
  const originalXHR = global.XMLHttpRequest;
  let sentBodies: SendArg[];
  let normalizeXhrRequestBody: (body?: SendArg) => SendArg;

  beforeEach(() => {
    sentBodies = [];

    class StubXMLHttpRequest {
      // eslint-disable-next-line class-methods-use-this
      send(body?: SendArg): void {
        sentBodies.push(body);
      }
    }

    (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      StubXMLHttpRequest;

    jest.isolateModules(() => {
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      ({ normalizeXhrRequestBody } = require("../../src/polyfills/xhr"));
    });
  });

  afterEach(() => {
    (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
      originalXHR;
  });

  it("send converts a URLSearchParams body to its string form", () => {
    const xhr = new global.XMLHttpRequest();
    const params = new URLSearchParams("tx=AAAA%2B%2F%3D%3D");

    xhr.send(params);

    expect(sentBodies).toHaveLength(1);
    expect(typeof sentBodies[0]).toBe("string");
    expect(sentBodies[0]).toBe(params.toString());
  });

  it("send passes a plain string body through untouched", () => {
    const xhr = new global.XMLHttpRequest();

    xhr.send("tx=already-encoded");

    expect(sentBodies[0]).toBe("tx=already-encoded");
  });

  it("normalizeXhrRequestBody stringifies URLSearchParams and passes other bodies through", () => {
    const params = new URLSearchParams("a=1&b=2");
    expect(normalizeXhrRequestBody(params)).toBe(params.toString());
    expect(normalizeXhrRequestBody("raw")).toBe("raw");
    expect(normalizeXhrRequestBody(null)).toBeNull();
    expect(normalizeXhrRequestBody(undefined)).toBeUndefined();
  });
});
