/* eslint-disable global-require */
/* eslint-disable import/no-unresolved */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
    minifierConfig: {
      // Terser minification options for production builds
      compress: {
        drop_console: true, // Remove console.log statements
        drop_debugger: true, // Remove debugger statements
        pure_funcs: [
          "console.log",
          "console.info",
          "console.debug",
          "console.warn",
        ],
      },
      mangle: {
        toplevel: true, // Mangle top-level variable names
      },
      output: {
        comments: false, // Remove all comments
        ascii_only: true, // Escape Unicode characters
      },
    },
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

      const resolved = context.resolveRequest(context, moduleName, platform);

      // bignumber.js v11 (pulled in by @stellar/stellar-sdk 16.x) ships a valid
      // CommonJS entry at dist/bignumber.cjs, but its package.json "react-native"
      // field redirects it to dist/bignumber.js — a browser-globals UMD build
      // that sets no module.exports. Metro honors that field, so
      // `require("bignumber.js")` resolves to {} and the SDK's
      // `_interopDefault(...).default.clone()` throws. Rewrite that one broken
      // target back to the real CJS build. (v9, used by stellar-base, is fine.)
      // Normalize separators so the match also holds on Windows (backslashes).
      const resolvedPath = resolved?.filePath?.replace(/\\/g, "/");
      if (
        moduleName === "bignumber.js" &&
        resolvedPath?.endsWith("/dist/bignumber.js")
      ) {
        return {
          ...resolved,
          filePath: resolved.filePath.replace(
            /bignumber\.js$/,
            "bignumber.cjs",
          ),
        };
      }

      return resolved;
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
