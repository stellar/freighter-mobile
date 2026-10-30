/**
 * bootstrap.js
 *
 * This file loads all polyfills and must be required before any other imports.
 * It's intentionally a .js file to avoid TypeScript transformations.
 *
 * DO NOT MODIFY THE IMPORT ORDER IN THIS FILE.
 */

// XHR polyfill for React Native - fixes Stellar SDK compatibility issues
require("./polyfills/xhr");

// AbortSignal.timeout/any polyfill - Hermes lacks these statics, which the
// Stellar SDK's feaxios HTTP client needs for transaction submission.
require("./polyfills/abortSignal");

// Response.body polyfill - React Native's fetch lacks the streaming body getter,
// which the Stellar SDK's bounded-fetch adapter (stellar.toml/federation
// resolution) reads from. Without it federation addresses fail to resolve.
require("./polyfills/responseBody");

// TextDecoder `fatal` support - Hermes has no native TextDecoder, and the
// fast-text-encoding fallback throws on `{ fatal: true }`, which the Stellar
// SDK's bounded-fetch adapter (stellar.toml/federation resolution) and strict
// XDR string decoding (scValToNative symbols/strings) both request. It requires
// fast-text-encoding itself, so it doesn't depend on the WalletConnect compat
// import order.
require("./polyfills/textDecoder");

// Export nothing - this file is used only for side effects
module.exports = {};
