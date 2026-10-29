module.exports = {
  assets: ["./src/assets/fonts/"],
  dependencies: {
    // Its BlurView only renders on iOS. On Android it would bring Dimezis
    // BlurView 2, which clashes with the 3.x the tab bar's blur uses.
    "@react-native-community/blur": {
      platforms: { android: null },
    },
  },
};
