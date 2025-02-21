module.exports = {
  preset: "react-native",
  setupFiles: ["./jest.setup.js"],
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  moduleNameMapper: {
    "^components/(.*)": "<rootDir>/src/components/$1",
    "^config/(.*)": "<rootDir>/src/config/$1",
    "^ducks/(.*)": "<rootDir>/src/ducks/$1",
    "^helpers/(.*)": "<rootDir>/src/helpers/$1",
    "^navigators/(.*)": "<rootDir>/src/navigators/$1",
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
