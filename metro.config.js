/* eslint-disable global-require */
/* eslint-disable import/no-unresolved */
/* eslint-disable @typescript-eslint/no-var-requires */
const { mergeConfig, getDefaultConfig } = require("@react-native/metro-config");
const { withNativeWind } = require("nativewind/metro");
const {
  wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
  },
  resolver: {
    assetExts: ["png", "jpg", "jpeg", "gif"],
    sourceExts: ["js", "jsx", "ts", "tsx", "svg", "json"],
    extraNodeModules: require("node-libs-react-native"),
  },
};

module.exports = wrapWithReanimatedMetroConfig(
  withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), {
    input: "./global.css",
  }),
);
