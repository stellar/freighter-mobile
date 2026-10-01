const CanvasKitInit = require("canvaskit-wasm/bin/full/canvaskit");
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
