const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

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
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
