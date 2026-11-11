const path = require("path");

// Resolved from Skia's own location: canvaskit-wasm is Skia's dependency, not
// this app's, so a hoisting change must not break the lookup.
const CanvasKitInit = require(
  require.resolve("canvaskit-wasm/bin/full/canvaskit", {
    paths: [
      path.dirname(require.resolve("@shopify/react-native-skia/package.json")),
    ],
  }),
);
const ReactNativeEnv = require("react-native/jest/react-native-env");

/**
 * The React Native Jest environment plus `global.CanvasKit`. Skia's own
 * jest mock (`@shopify/react-native-skia/lib/module/mock`) builds its `Skia`
 * API from this global at require time, so any test that calls a Skia
 * geometry helper (`rect`, `rrect`, `vec`, …) — not just one that renders a
 * `<Canvas>` — needs it. Wired globally in `jest.config.js` as
 * `testEnvironment`: components that render Skia content (e.g. Shimmer) get
 * rendered from suites that never mention Skia, so there is no single
 * import site to hang a per-file opt-in on.
 */
module.exports = class SkiaTestEnvironment extends ReactNativeEnv {
  async setup() {
    await super.setup();
    this.global.CanvasKit = await CanvasKitInit({});
  }
};
