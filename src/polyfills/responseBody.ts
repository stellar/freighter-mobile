/**
 * Response.body ReadableStream Polyfill for React Native
 *
 * React Native's fetch (whatwg-fetch) implements the Body consumers
 * `text()`/`arrayBuffer()`/`json()` but never exposes the streaming
 * `Response.body` getter, so `response.body` is `undefined`.
 *
 * The Stellar SDK (v16+) routes HTTP through `feaxios`. Whenever a request sets
 * `maxContentLength` or `maxRedirects` it takes the SDK's bounded-fetch adapter,
 * which reads the response body *exclusively* via `response.body.getReader()`.
 * `StellarToml.Resolver.resolve()` and `Federation.Server` both set those
 * options, so on React Native the adapter saw `body === undefined`, fell back to
 * an empty buffer, and every stellar.toml parsed to `{}`. Federation lookups then
 * failed with "stellar.toml does not contain FEDERATION_SERVER field".
 *
 * This polyfill backs the missing getter with the `arrayBuffer()` that React
 * Native does support, exposing a single-chunk `ReadableStream`. It is guarded so
 * it no-ops on runtimes (Node/V8 in Jest, future RN) that already provide
 * `Response.body`.
 *
 * `ReadableStream` is imported from `web-streams-polyfill` because Hermes does not
 * provide a global one.
 */
import { ReadableStream } from "web-streams-polyfill";

/** The subset of `Response` this polyfill relies on. */
interface ArrayBufferBody {
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Builds a one-shot `ReadableStream` that emits the response body as a single
 * `Uint8Array` chunk, sourced from `arrayBuffer()`. A rejected `arrayBuffer()`
 * surfaces as a stream error so callers see the original failure.
 */
export const createResponseBodyStream = (
  response: ArrayBufferBody,
): ReadableStream<Uint8Array> => {
  const bodyPromise = response.arrayBuffer();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      bodyPromise
        .then((buffer) => {
          controller.enqueue(new Uint8Array(buffer));
          controller.close();
        })
        .catch((error: unknown) => controller.error(error));
    },
  });
};

/**
 * Defines a lazy `body` getter on the target's prototype when it is missing. The
 * stream is memoized per response instance so repeated access returns the same
 * stream and the single-use body is not consumed twice.
 */
export const installResponseBodyPolyfill = (
  ResponseCtor: typeof Response | undefined = typeof Response === "undefined"
    ? undefined
    : Response,
): void => {
  if (!ResponseCtor) {
    return;
  }

  if (Object.getOwnPropertyDescriptor(ResponseCtor.prototype, "body")) {
    return;
  }

  Object.defineProperty(ResponseCtor.prototype, "body", {
    configurable: true,
    get(this: ArrayBufferBody): ReadableStream<Uint8Array> {
      const stream = createResponseBodyStream(this);
      Object.defineProperty(this, "body", {
        configurable: true,
        value: stream,
      });
      return stream;
    },
  });
};

installResponseBodyPolyfill();

export {};
