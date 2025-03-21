# Polyfills Directory

This directory contains polyfills needed to make certain functionality work
properly in React Native.

## Current Polyfills

### xhr.ts

Fixes issues with `XMLHttpRequest` in React Native, specifically:

- Prevents errors when the Stellar SDK tries to set unsupported `responseType`
  values:
  - `ms-stream`
  - `moz-chunked-arraybuffer`

These values are browser-specific and not supported in React Native's
implementation.

## Usage

Polyfills are imported at the entry point of the app (`src/index.ts`) to ensure
they are applied before any other code runs.
