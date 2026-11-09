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

### textDecoder.ts

Adds `fatal` support to the global `TextDecoder`. Hermes has no native
`TextDecoder`, so the app uses `fast-text-encoding`, whose constructor throws
"the 'fatal' option is unsupported" for
`new TextDecoder("utf-8", { fatal: true })`. Node supports it, so Jest never
sees the failure.

The Stellar SDK asks for a strict decoder in three places:

- The bounded-fetch adapter, which decodes every response body. Without this
  polyfill, federation addresses don't resolve and stellar.toml asset icons
  don't load.
- `XdrString.toStringStrict()`, behind `scValToNative()` for symbols and
  strings. Without this polyfill they come back as raw bytes, not strings.
- WASM custom-section name parsing.

The polyfill wraps the global `TextDecoder`. A UTF-8 decoder built with
`{ fatal: true }` checks its input with a WHATWG-conformant strict validator
(`isValidUtf8`) and throws a `TypeError` on malformed bytes. It also follows the
WHATWG byte order mark rule, which `fast-text-encoding` never applies: unless
`ignoreBOM` is set, it drops one leading U+FEFF from its output. The SDK's
bounded fetch builds its decoder with the default `ignoreBOM`, so a stellar.toml
or federation response that starts with a BOM parses, as on Node.
`XdrString.toStringStrict()` and the WASM name parser pass `ignoreBOM: true` and
keep the BOM.

Every other decoder behaves exactly as before, including its output, its errors
and the BOM it leaves in place. The polyfill does nothing when `TextDecoder`
already supports `fatal`, as on Node or a future Hermes.

It requires `fast-text-encoding` itself, so it doesn't depend on the order of
the WalletConnect compat import. It also installs `Buffer` first, as `shim.js`
does later, so `fast-text-encoding` keeps decoding through `Buffer`.

## Usage

Polyfills are required from `src/bootstrap.js`, which `index.js` loads before
the app, so they are applied before any other code runs. Add new ones at the end
of that file and don't reorder it.
