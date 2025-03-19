// eslint-disable-next-line @typescript-eslint/no-var-requires
const getSrcDirs = require("./config/getSrcDirs");

module.exports = {
  presets: ["babel-preset-expo"],
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
  ],
};
