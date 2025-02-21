module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [
    "babel-plugin-styled-components",
    [
      "module-resolver",
      {
        root: ["./src"],
        extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
        alias: {
          components: "./src/components",
          config: "./src/config",
          ducks: "./src/ducks",
          helpers: "./src/helpers",
          navigators: "./src/navigators",
        },
      },
    ],
  ],
};
