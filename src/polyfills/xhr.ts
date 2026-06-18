/**
 * XMLHttpRequest Polyfill for React Native
 *
 * Two fixes, both for Stellar SDK HTTP compatibility:
 *
 * 1. responseType — the SDK sets browser-specific responseType values
 *    ('ms-stream', 'moz-chunked-arraybuffer') that React Native doesn't support.
 *
 * 2. URLSearchParams request bodies — the SDK (v16+) routes HTTP through feaxios,
 *    whose transformer converts a form-urlencoded string body into a
 *    URLSearchParams object. React Native's fetch (whatwg-fetch) is XHR-based and
 *    calls `xhr.send(urlSearchParams)` with the object; RN's convertRequestBody
 *    only serializes string/Blob/FormData/ArrayBuffer, so the body went out empty
 *    and Horizon rejected every transaction submit as `transaction_malformed`
 *    (empty envelope_xdr). Sending the string form fixes it.
 */

// Store reference to the original XMLHttpRequest
const OriginalXMLHttpRequest = global.XMLHttpRequest;

// List of unsupported responseTypes
const UNSUPPORTED_RESPONSE_TYPES = ["ms-stream", "moz-chunked-arraybuffer"];

// Derived from the actual send() signature so we don't depend on DOM lib type
// names (e.g. XMLHttpRequestBodyInit) that React Native's types omit.
type XhrBody = Parameters<XMLHttpRequest["send"]>[0];

/**
 * Normalizes an XHR request body for React Native: a URLSearchParams body is
 * converted to its string form (RN's XHR cannot serialize the object). All other
 * body types pass through untouched.
 */
export const normalizeXhrRequestBody = (body?: XhrBody): XhrBody => {
  if (
    typeof URLSearchParams !== "undefined" &&
    body instanceof URLSearchParams
  ) {
    return body.toString();
  }

  return body;
};

// Create a patched version of XMLHttpRequest
class PatchedXMLHttpRequest extends OriginalXMLHttpRequest {
  // Override the responseType setter to filter out unsupported values
  set responseType(value: string) {
    // If the value is one of the unsupported types, use 'text' instead
    if (UNSUPPORTED_RESPONSE_TYPES.includes(value)) {
      // Use the original setter with a supported value
      super.responseType = "text";
    } else {
      // Use the original setter with the provided value
      super.responseType = value as XMLHttpRequestResponseType;
    }
  }

  // Ensure we correctly pass through the responseType getter
  get responseType(): XMLHttpRequestResponseType {
    return super.responseType;
  }

  // Convert URLSearchParams bodies to a string RN can serialize
  send(body?: XhrBody): void {
    super.send(normalizeXhrRequestBody(body));
  }
}

// Replace the global XMLHttpRequest with our patched version
global.XMLHttpRequest = PatchedXMLHttpRequest;
