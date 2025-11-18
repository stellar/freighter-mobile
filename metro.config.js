/* eslint-disable global-require */
/* eslint-disable import/no-unresolved */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
const { mergeConfig, getDefaultConfig } = require("@react-native/metro-config");
const { withSentryConfig } = require("@sentry/react-native/metro");
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
    sourceExts: ["js", "jsx", "ts", "tsx", "svg", "json", "cjs"],
    extraNodeModules: require("node-libs-react-native"),
    unstable_enablePackageExports: false,
    unstable_enableSymlinks: false,
    resolveRequest: (context, moduleName, platform) => {
      // Handle @noble/hashes crypto.js import
      if (moduleName === "@noble/hashes/crypto.js") {
        return {
          filePath: require.resolve("@noble/hashes/crypto.js"),
          type: "sourceFile",
        };
      }

      // Handle multiformats cjs imports
      if (moduleName.startsWith("multiformats/cjs/")) {
        const path = moduleName.replace("multiformats/cjs/", "");
        return {
          filePath: require.resolve(`multiformats/cjs/src/${path}`),
          type: "sourceFile",
        };
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = withSentryConfig(
  wrapWithReanimatedMetroConfig(
    withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), {
      input: "./global.css",
    }),
  ),
  { annotateReactComponents: true },
);
