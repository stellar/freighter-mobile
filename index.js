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

// First, load polyfills
require("./src/bootstrap.js");

// Load the shim
require("./shim.js");

// Then initialize the app
require("./src/index");
