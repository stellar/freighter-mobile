// eslint-disable-next-line @typescript-eslint/no-var-requires
const getSrcDirs = require("./config/getSrcDirs");

module.exports = {
  preset: "react-native",
  setupFiles: ["./jest.setup.js"],
  moduleNameMapper: {
    ...getSrcDirs(__dirname, "jest"),
    "\\.svg$": "<rootDir>/__mocks__/svgMock.tsx",
    "^helpers/(.*)$": "<rootDir>/__mocks__/helpers/$1",
  },
  transformIgnorePatterns: [
    `node_modules/(?!(${[
      "react-native",
      "@react-native",
      "@react-navigation",
      "@react-native-community",
      "react-native-safe-area-context",
      "react-redux",
      "@reduxjs",
      "redux",
      "redux-thunk",
      "react-native-responsive-screen",
    ].join("|")})/)`,
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  coveragePathIgnorePatterns: ["/node_modules/", "/jest"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
};
