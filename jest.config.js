// eslint-disable-next-line @typescript-eslint/no-var-requires
const getSrcDirs = require("./config/getSrcDirs");

module.exports = {
  preset: "react-native",
  testTimeout: 30000, // 30 seconds timeout for all tests
  // Global so every suite can render a Skia-backed component (e.g. Shimmer)
  // without an opt-in per test file; see jest/skiaTestEnvironment.js.
  testEnvironment: "<rootDir>/jest/skiaTestEnvironment.js",
  setupFiles: ["./jest.setup.js", "@shopify/react-native-skia/jestSetup.js"],
  moduleNameMapper: {
    ...getSrcDirs(__dirname, "jest"),
    "\\.svg$": "<rootDir>/__mocks__/svgMock.tsx",
    "^helpers/(.*)$": "<rootDir>/__mocks__/helpers/$1",
    "^services/(.*)$": "<rootDir>/__mocks__/services/$1",
  },
  transformIgnorePatterns: [
    `node_modules/(?!(${[
      "react-native",
      "@react-native",
      "@react-navigation",
      "@react-native-community",
      "react-native-safe-area-context",
      "react-native-responsive-screen",
      "@shopify/react-native-skia",
      "zeego",
      "nativewind",
      "tailwindcss",
      "react-native-css-interop",
      "react-native-reanimated",
      // 2.28.0 ships a packaging defect: a handful of files under
      // `lib/commonjs` (e.g. `handlers/gestures/nativeGesture`,
      // `handlers/NativeViewGestureHandler`) are raw `.ts` where a `.js` is
      // expected, and the package's `react-native` field points the entry at
      // `src/index.ts` anyway. Metro is fine with both; Jest needs babel to
      // strip the TypeScript, which only happens inside this allow-list.
      "react-native-gesture-handler",
      "@gorhom/bottom-sheet",
      "react-native-worklets",
      "react-native-keyboard-controller",
      "react-native-qrcode-svg",
      "stellar-hd-wallet",
      // v17's CJS build `require()`s ESM-only deps (@noble/*, @exodus/bytes,
      // smol-toml, uint8array-extras, eventsource), some nested under the SDK.
      // Node 22.12+ loads those natively, but Jest's CJS module registry does
      // not, so babel has to transform them here.
      "@stellar/stellar-sdk",
      "@noble",
      "@exodus/bytes",
      "smol-toml",
      "uint8array-extras",
      "eventsource",
      "react-native-config",
      "@react-native-cookies/cookies",
      "react-native-view-shot",
      "react-native-webview",
      "react-native-quick-crypto",
      "react-native-nitro-modules",
      "react-native-inappbrowser-reborn",
    ].join("|")})/)`,
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node", "mjs"],
  // Ignore nested git worktrees created under .claude/ (e.g. by Claude Code
  // sessions). They are full repo copies whose node_modules/__mocks__ otherwise
  // collide via Haste and break the whole suite.
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/.claude/"],
  // Only files that name themselves as suites. The default treats every file
  // under `__tests__/` as one, which forced an ignore rule for the shared
  // helpers in `__tests__/support/` — and that rule would then have silently
  // swallowed any real test placed there, reporting nothing rather than
  // failing.
  testMatch: ["**/*.(test|spec).[jt]s?(x)"],
  coveragePathIgnorePatterns: ["/node_modules/", "/jest"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx|mjs)$": "babel-jest",
  },
};
