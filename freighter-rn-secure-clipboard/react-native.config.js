module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: "android",
        packageImportPath:
          "import org.stellar.freighterwallet.SecureClipboardPackage;",
      },
      ios: {
        podspecPath: "ios/SecureClipboardModule.podspec",
      },
    },
  },
};
