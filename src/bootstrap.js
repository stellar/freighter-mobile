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

// Export nothing - this file is used only for side effects
module.exports = {};
