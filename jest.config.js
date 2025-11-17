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
      "react-native-qrcode-svg",
      "stellar-hd-wallet",
      "react-native-config",
      "@react-native-cookies/cookies",
      "react-native-view-shot",
      "react-native-webview",
      "react-native-fast-opencv",
      "react-native-inappbrowser-reborn",
    ].join("|")})/)`,
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  coveragePathIgnorePatterns: ["/node_modules/", "/jest"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
};
