/**
 * XMLHttpRequest Polyfill for React Native
 *
 * This polyfill fixes issues with the Stellar SDK trying to use browser-specific
 * responseType values ('ms-stream' and 'moz-chunked-arraybuffer') that are not
 * supported in React Native.
 */

// Store reference to the original XMLHttpRequest
const OriginalXMLHttpRequest = global.XMLHttpRequest;

// List of unsupported responseTypes
const UNSUPPORTED_RESPONSE_TYPES = ["ms-stream", "moz-chunked-arraybuffer"];

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
}

// Replace the global XMLHttpRequest with our patched version
global.XMLHttpRequest = PatchedXMLHttpRequest;

export {};
