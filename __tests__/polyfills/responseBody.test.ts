/**
 * Response.body ReadableStream Polyfill Tests
 *
 * React Native's fetch (whatwg-fetch) implements Body.text()/arrayBuffer()/json()
 * but does NOT expose the streaming `Response.body` getter. Stellar SDK v16's
 * feaxios bounded-fetch adapter (used by StellarToml.Resolver and
 * Federation.Server whenever maxContentLength/maxRedirects are set) reads the
 * response exclusively via `response.body.getReader()`. With `body` undefined the
 * adapter fell back to an empty buffer, so every stellar.toml parsed to `{}` and
 * federation lookups failed with "stellar.toml does not contain FEDERATION_SERVER
 * field".
 *
 * Jest (V8/Node) provides a native streaming `Response.body`, so these tests run
 * the polyfill against plain prototype objects lacking `body` to reproduce the
 * React Native gap.
 */
type ArrayBufferBody = { arrayBuffer(): Promise<ArrayBuffer> };

type ReadableLike = {
  getReader(): {
    read(): Promise<{ done: boolean; value?: Uint8Array }>;
  };
};

let createResponseBodyStream: (response: ArrayBufferBody) => ReadableLike;
let installResponseBodyPolyfill: (target?: unknown) => void;

beforeAll(() => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const responseBodyPolyfill = require("../../src/polyfills/responseBody");
  createResponseBodyStream = responseBodyPolyfill.createResponseBodyStream;
  installResponseBodyPolyfill =
    responseBodyPolyfill.installResponseBodyPolyfill;
});

const encode = (text: string): ArrayBuffer => {
  const { buffer, byteOffset, byteLength } = new TextEncoder().encode(text);
  return buffer.slice(byteOffset, byteOffset + byteLength);
};

const readStream = async (stream: ReadableLike): Promise<string> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return new TextDecoder().decode(merged);
};

describe("Response.body polyfill", () => {
  it("createResponseBodyStream streams the body that arrayBuffer() returns", async () => {
    // A real stellar.toml snippet: the streamed bytes must round-trip intact so
    // the SDK's smol-toml parse can recover FEDERATION_SERVER, the field whose
    // absence broke federation resolution.
    const toml = 'FEDERATION_SERVER = "https://stellar.org/federation"\n';
    const response = { arrayBuffer: () => Promise.resolve(encode(toml)) };

    const text = await readStream(createResponseBodyStream(response));

    expect(text).toBe(toml);
  });

  it("createResponseBodyStream surfaces arrayBuffer() rejection as a stream error", async () => {
    const failure = new Error("network down");
    const response = { arrayBuffer: () => Promise.reject(failure) };

    await expect(
      readStream(createResponseBodyStream(response)),
    ).rejects.toThrow("network down");
  });

  it("installs a working Response.body getter when one is missing", async () => {
    const toml = 'FEDERATION_SERVER = "https://example.com/federation"\n';
    const prototype: ArrayBufferBody = {
      arrayBuffer: () => Promise.resolve(encode(toml)),
    };
    const target = { prototype } as unknown as typeof Response;

    expect(Object.getOwnPropertyDescriptor(prototype, "body")).toBeUndefined();

    installResponseBodyPolyfill(target);

    const response = Object.create(prototype) as { body: ReadableLike | null };
    expect(response.body).not.toBeNull();
    expect(await readStream(response.body as ReadableLike)).toBe(toml);
  });

  it("memoizes the stream so the single-use body is not consumed twice", () => {
    const prototype: ArrayBufferBody = {
      arrayBuffer: () => Promise.resolve(encode('FEDERATION_SERVER = "x"')),
    };
    const target = { prototype } as unknown as typeof Response;

    installResponseBodyPolyfill(target);

    const response = Object.create(prototype) as { body: ReadableLike };
    expect(response.body).toBe(response.body);
  });

  it("does not override a runtime that already provides Response.body", () => {
    const nativeStream = Symbol("native-body");
    const prototype: ArrayBufferBody = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    };
    Object.defineProperty(prototype, "body", {
      configurable: true,
      get: () => nativeStream,
    });
    const target = { prototype } as unknown as typeof Response;

    installResponseBodyPolyfill(target);

    const response = Object.create(prototype) as { body: unknown };
    expect(response.body).toBe(nativeStream);
  });
});
