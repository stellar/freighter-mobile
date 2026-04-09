# Dependencies

## Package Manager

**Yarn** is the package manager. Do not use npm.

## Node Version

Node >= 20 is required (specified in `package.json` engines). CI uses Node 20.

## Native Dependencies

These packages require native linking and affect both iOS and Android build
configurations:

- `react-native-keychain` — Secure storage (Keychain/Keystore)
- `@d11/react-native-fast-image` — Cached image loading
- `react-native-reanimated` — Animation library
- And others

When adding a package with native code, you must rebuild both platforms.

## iOS Dependencies (CocoaPods)

After adding a native dependency:

```bash
yarn pod-install
```

To clean and reinstall CocoaPods (when encountering pod issues):

```bash
cd ios && pod deintegrate && pod cache clean --all
cd .. && yarn pod-install
```

## Android Dependencies (Gradle)

Clean the Android build:

```bash
yarn gradle-clean
```

JDK 17+ is recommended for Android builds.

## Full Environment Reset

When things go wrong, do a full reset:

```bash
yarn r-install
```

This resets the environment and rebuilds everything from scratch.

## Metro Cache

Start Metro bundler with a clean cache:

```bash
yarn start-c
```

This runs `react-native start --reset-cache`.

## Adding a Native Dependency

1. Add the package to `package.json`
2. Run `yarn install`
3. Run `yarn pod-install` (for iOS)
4. Rebuild both platforms and verify

## Upgrading React Native

1. Follow the official
   [React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper/)
2. Test thoroughly on both iOS and Android
3. Check all native module compatibility with the new RN version
4. Pay special attention to `react-native-reanimated`, `react-native-keychain`,
   and other native modules

## Environment Variables

- Configuration lives in `.env` (created from `.env.example`)
- The `.env.example` template contains 48 variables
- **Never commit `.env`** — it may contain secrets
- Keep `.env.example` updated when adding new variables
- E2E test variables (`IS_E2E_TEST`, `E2E_TEST_RECOVERY_PHRASE`, etc.) are also
  configured here
