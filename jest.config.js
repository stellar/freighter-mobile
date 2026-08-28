// eslint-disable-next-line @typescript-eslint/no-var-requires
const getSrcDirs = require("./config/getSrcDirs");

module.exports = {
  preset: "react-native",
  testTimeout: 30000, // 30 seconds timeout for all tests
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
  coveragePathIgnorePatterns: ["/node_modules/", "/jest"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx|mjs)$": "babel-jest",
  },
};
