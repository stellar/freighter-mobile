// eslint-disable-next-line @typescript-eslint/no-var-requires
const getSrcDirs = require("./config/getSrcDirs");

module.exports = {
  presets: ["module:@react-native/babel-preset", "nativewind/babel"],
  plugins: [
    "babel-plugin-styled-components",
    [
      "module-resolver",
      {
        root: ["./src", "./"],
        extensions: [
          ".ios.js",
          ".android.js",
          ".js",
          ".ts",
          ".tsx",
          ".json",
          ".svg",
        ],
        alias: getSrcDirs(__dirname),
      },
    ],
    "react-native-reanimated/plugin",
  ],
};
