/* eslint-disable */

/**
 * Main entry point for the React Native app
 *
 * This file is the first thing that runs when the app starts.
 * It loads the polyfills and then the main app.
 *
 * If you need to add more polyfills, add them to the bootstrap.js file.
 *
 * DO NOT MODIFY THE IMPORT ORDER IN THIS FILE.
 */

// Fix broken Hermes TypedArray methods (subarray, map, filter, slice).
// Must run before any code that touches TypedArrays or Buffer.
// See: https://github.com/nicolo-ribaudo/tc39-proposal-fix-typedarray-constructor
require("@exodus/patch-broken-hermes-typed-arrays");

// First, load polyfills
require("./src/bootstrap.js");

// Load the shim
require("./shim.js");

// Then initialize the app
require("./src/index");
