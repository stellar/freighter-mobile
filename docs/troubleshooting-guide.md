# N10 — Troubleshooting Guide: Freighter Mobile

_Last updated: 2026-04-08_

Common issues and solutions when developing Freighter Mobile.

## Setup Issues

### `yarn install` fails with native dependency errors

**Symptom:** Build errors related to `react-native-skia`,
`react-native-reanimated`, or other native modules.

**Solution:**

```bash
yarn r-install    # Full reset: cleans node_modules, reinstalls everything
```

### CocoaPods installation fails (iOS)

**Symptom:** `pod install` fails with version conflicts or missing specs.

**Solution:**

```bash
cd ios
pod cache clean --all    # Clear pod cache
cd ..
yarn pod-install         # Reinstall
```

> **Warning:** Do not run `pod deintegrate` — it strips the entire Xcode project
> integration. Clean cache + reinstall is sufficient.

If still failing, check your Ruby version. CocoaPods works best with
rbenv-managed Ruby 3.1-3.3.

**macOS 26 note:** macOS 26 ships with Ruby 3.4 as the system Ruby. Ruby 3.4
removed `bigdecimal`, `logger`, `benchmark`, and `mutex_m` from the standard
library. The project Gemfile already adds these as explicit gems, so
`bundle install` followed by `bundle exec pod install` will work. However,
running `pod install` without `bundle exec` (using system Ruby directly) may
fail. Always use:

```bash
bundle exec pod install    # Or use yarn pod-install, which does this for you
```

### Xcode build fails after updating macOS or Xcode

**Symptom:** Build errors mentioning missing SDKs, changed architectures, or
code signing issues.

**Solution:**

1. Open Xcode and accept any license agreements
2. Install command-line tools: `xcode-select --install`
3. Clean derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
4. Reinstall pods: `yarn pod-install`
5. Rebuild: `yarn ios`

### Android Gradle sync fails

**Symptom:** `Could not resolve` errors or Gradle version mismatches.

**Solution:**

```bash
yarn gradle-clean    # Clean Gradle cache
yarn android         # Retry build
```

Ensure you have a compatible JDK installed (JDK 17+ recommended for modern
Android Gradle builds):

```bash
java -version    # Should show 17.x or newer
```

### Husky pre-commit hooks fail or don't run

**Symptom:** Commits succeed without running ESLint/Prettier, or you see
"command not found" / wrong Node version errors on commit.

**Solution (nvm users):** Husky 9 requires `~/.config/husky/init.sh` — the old
`~/.huskyrc` file is not read:

```bash
# ~/.config/husky/init.sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use
```

**Solution (hooks skipped silently):** Verify the hook files are executable:

```bash
ls -la .husky/pre-commit    # Should show -rwxr-xr-x
chmod +x .husky/pre-commit  # Fix if not executable
```

### IDE and ESLint plugins not loading

**Symptom:** ESLint errors not shown in the editor, or the IDE reports "ESLint
server failed to start" / "No ESLint configuration found".

**Solution:** Ensure the ESLint IDE extension is installed and pointing to the
project config:

1. **VS Code:** Install the
   [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
   (≥3.0.10 for flat config support). Confirm it activates on `.ts`/`.tsx`
   files.
2. **WebStorm/IntelliJ:** Enable ESLint under Languages & Frameworks >
   JavaScript
   > Code Quality Tools > ESLint → "Automatic ESLint configuration".
3. **Validate manually:**
   ```bash
   npx eslint src/components/sds/Button.tsx
   ```
   If this errors, fix the ESLint config before relying on IDE integration.
4. **Prettier plugin:** Install the
   [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
   and set `"editor.defaultFormatter": "esbenp.prettier-vscode"` in VS Code
   settings to match what `lint-staged` applies on commit.

### Metro bundler won't start or crashes

**Symptom:** "Metro has encountered an error" or bundler hangs.

**Solution:**

```bash
yarn start-c    # Start Metro with cache clear
```

If that doesn't work:

```bash
watchman watch-del-all    # Reset watchman
yarn node-clean           # Clean node_modules
yarn install              # Reinstall
yarn start                # Restart Metro
```

### Can't run on physical iOS device

**Symptom:** Build succeeds but Xcode refuses to install on the device with
"Unable to install" or "Device is not available for development."

**Solution:**

1. The device must be registered in the Apple Developer portal's device list.
   Ask a team member with Admin/Account Holder access to add your device UDID.
2. After the device is added, **provisioning profiles take up to 24 hours to
   update**. You will not be able to install until the profiles regenerate.
3. Once updated, in Xcode go to Settings > Accounts > your team > Download
   Manual Profiles, then rebuild.

### Can't install on Android device (version conflict)

**Symptom:** `adb install` fails with `INSTALL_FAILED_VERSION_DOWNGRADE` or the
app won't install over an existing version.

**Solution:** If you're trying to install a build with a lower version code than
what's currently on the device, you need to force the install:

```bash
adb install -r -d app-debug.apk    # -r replaces, -d allows downgrade
```

Or uninstall the existing app first:

```bash
adb uninstall org.stellar.freighterdev
yarn android
```

### Clang or native library errors after macOS update

**Symptom:** Build fails with errors from Clang, `ld`, or native libraries
(e.g., `library not found for -lc++`, `clang: error: no such file or directory`,
or linker failures) right after a macOS or Xcode update.

**Solution:**

1. First try the standard Xcode fix: `xcode-select --install` and clean derived
   data (see "Xcode build fails after updating macOS or Xcode" above).
2. If that doesn't resolve it, try using **Xcode Beta** — Apple sometimes ships
   toolchain fixes in beta before the stable release catches up:
   ```bash
   sudo xcode-select --switch /Applications/Xcode-beta.app
   yarn pod-install
   yarn ios
   ```
3. Once a stable Xcode update resolves the issue, switch back:
   ```bash
   sudo xcode-select --switch /Applications/Xcode.app
   ```

## Build Issues

### "No bundle URL present" (iOS)

**Symptom:** White screen on iOS simulator with "No bundle URL present" error.

**Solution:**

1. Ensure Metro is running (`yarn start`)
2. If Metro is running, try: `yarn ios` (rebuilds the native project)
3. Check that your `.env` file exists and has required values

### Android build succeeds but app crashes on launch

**Symptom:** App installs but immediately crashes.

**Solution:**

1. Check `adb logcat` for the crash reason
2. Common cause: missing or invalid `.env` values
3. Try a clean build:

```bash
yarn android-dev-clean    # Clean build + run
```

### "Duplicate class" errors (Android)

**Symptom:** Build fails with `Duplicate class` found in modules.

**Solution:**

```bash
cd android
./gradlew clean
cd ..
yarn android
```

### Xcode build fails with "exit code 65" (iOS)

**Symptom:** `xcodebuild` fails with `** BUILD FAILED **` and `exit code 65`.
The actual error is buried in the output — often hundreds of lines above the
final failure message.

**Common causes and solutions:**

1. **Stale derived data:** Xcode's build cache is corrupted.

   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData
   yarn pod-install
   yarn ios
   ```

2. **CocoaPods out of sync:** Pods don't match current native dependencies.

   ```bash
   cd ios
   pod cache clean --all
   cd ..
   yarn pod-install
   yarn ios
   ```

   > **Warning:** Do not run `pod deintegrate` — it strips the entire Xcode
   > project integration and can break the setup in ways that are hard to
   > recover from. Cleaning the pod cache and reinstalling is sufficient.

3. **Wrong Xcode version or command-line tools:** After macOS or Xcode update.

   ```bash
   sudo xcode-select --switch /Applications/Xcode.app
   xcode-select --install
   ```

4. **Signing issues:** See "Code signing errors" below.

5. **Missing simulator runtime:** The target simulator OS version isn't
   installed.
   - Open Xcode > Settings > Platforms and install the required runtime.

**Debugging tip:** When an iOS build fails, **open the project in Xcode first**
(`open ios/freighter-mobile.xcworkspace`) — Xcode is significantly better than
the terminal for diagnosing build failures. Build from there and check the Issue
Navigator (left sidebar): it shows the root cause directly, with file and line
references, rather than the wall of text that `yarn ios` produces.

If you need to diagnose from the terminal, scroll up in the output — the real
error (missing header, signing failure, compilation error) is usually 50-200
lines above the `exit code 65` message.

### Code signing errors (iOS)

**Symptom:** Build fails with "Signing for X requires a development team."

**Solution:** For development, use automatic signing:

1. Open `ios/freighter-mobile.xcworkspace` in Xcode
2. Select the project target
3. Under "Signing & Capabilities", select your development team
4. Use the dev scheme (`freighter-mobile-Dev`)

### Android emulator out of memory / long error cascade

**Symptom:** Android build or app launch fails with a long cascade of errors —
hundreds of lines of `java.lang.OutOfMemoryError`, `GC overhead limit exceeded`,
Gradle daemon crashes, or the emulator itself becomes unresponsive. The errors
look catastrophic but the root cause is simply the emulator running out of RAM.

**Solutions:**

1. **Increase emulator RAM:**

   - Open Android Studio > Device Manager > Edit (pencil icon) on your emulator
   - Under "Show Advanced Settings", increase **RAM** to at least 2048 MB (4096
     MB recommended)
   - Increase **VM heap** to at least 512 MB
   - Click Finish and restart the emulator

   > **If the problem persists after increasing RAM:** The AVD config file may
   > not reflect the change — this is a known Android Studio quirk. The most
   > reliable fix is to **delete the emulator and recreate it** with the desired
   > RAM from the start:
   >
   > - Device Manager > overflow menu (three-dot) > Delete
   > - Create a new device with the same target API, setting RAM to 4096 MB
   >   under Show Advanced Settings before finishing

2. **Increase Gradle daemon memory:** Edit `android/gradle.properties`:

   ```properties
   org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
   ```

3. **Close other resource-heavy apps:** The Android emulator is a full virtual
   machine. Close browser tabs, Docker, other IDEs, and other emulators to free
   memory.

4. **Use a physical device instead:** If your machine has limited RAM (< 16 GB),
   connect a physical Android device via USB and run:

   ```bash
   yarn android-dev    # Will target the connected device
   ```

5. **Cold-boot the emulator:** Sometimes the emulator's snapshot is corrupted.

   - Device Manager > Cold Boot Now (three-dot menu on the emulator)

6. **Kill and restart Gradle daemon:**
   ```bash
   cd android
   ./gradlew --stop
   cd ..
   yarn android-dev-clean
   ```

**How to tell it's a memory issue:** If you see any of these in the error
output, it's memory:

- `java.lang.OutOfMemoryError`
- `GC overhead limit exceeded`
- `Gradle build daemon disappeared unexpectedly`
- `Could not create the Java Virtual Machine`
- Emulator UI freezing or going black

## Testing Issues

### Jest tests fail with "Cannot find module"

**Symptom:** Module resolution errors in tests.

**Solution:** Check that `jest.config.js` module mappings are up to date. For
new modules, you may need to add a mock in `__mocks__/`.

### Maestro e2e test failures

For Maestro setup, flow names, and common failure patterns (app not found,
element timeouts, CI artifacts), see the [E2E Testing Guide](../e2e/README.md)
and the detailed guides in `e2e/docs/`.

### Tests pass locally but fail in CI

**Symptom:** Green locally, red in CI.

**Solution:**

- CI runs on specific OS versions (macOS for iOS, Linux for Android) and may be
  slower — timing-sensitive tests may need longer timeouts
- Download CI artifacts (logs, screenshots, recordings) from
  `e2e/docs/artifacts-and-debugging.md` to diagnose failures you can't reproduce
  locally

## iOS 26 / Xcode 26 Compatibility Issues

These issues affect builds and runtime when targeting iOS 26 or using Xcode 26+.

### Xcode 26.4 fmt/consteval compilation errors

**Symptom:** Build fails with compilation errors from the `fmt` C++ formatting
library, e.g., errors around `consteval` keyword in `RCT-Folly` or
`react-native-skia`.

**Root cause:** Xcode 26 ships with a new Clang version that reports `consteval`
support but fails to properly handle it, breaking the `fmt` library's
compile-time checks.

**Solution:** Update the `fmt` dependency. Apply the RCT-Folly pod spec
modification to use fmt 12.1.0:

1. Check
   [facebook/react-native#55601](https://github.com/facebook/react-native/issues/55601)
   for the latest patch
2. If a patch isn't available yet, downgrade to Xcode 26.3 as a temporary
   workaround

**Affected libraries:** `react-native-skia`
([Shopify/react-native-skia#3782](https://github.com/Shopify/react-native-skia/issues/3782)),
`RCT-Folly`, and any pod using `fmt`

### Xcode 26 precompiled builds fail (Swift explicit modules)

**Symptom:** Build fails when using precompiled pods or frameworks with Xcode
26, with errors about Swift module compilation.

**Solution:** Xcode 26 enables Swift explicit modules by default. Disable it in
your Xcode project:

```
SWIFT_ENABLE_EXPLICIT_MODULES = NO
```

Or add to `post_install` in `ios/Podfile`:

```ruby
config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
```

### xcodebuild hangs after BUILD SUCCEEDED on macOS 26.3

**Symptom:** `react-native run-ios` hangs indefinitely after the build succeeds.
The `xcodebuild` process never exits.

**Root cause:** A regression in macOS 26.3 + Xcode 26.2+ where `xcodebuild`
doesn't properly terminate.

**Solution:** See
[react-native-community/cli#2768](https://github.com/react-native-community/cli/issues/2768)
for workarounds. As a temporary fix, build from Xcode directly
(`open ios/freighter-mobile.xcworkspace`) and launch from there.

### SceneDelegate adoption warning

**Symptom:** Xcode 26 shows a warning: "UIScene lifecycle must be supported.
Failure to adopt will result in an assert in the future."

**Current status:** The project does not yet use `SceneDelegate`. This is a
warning for now, but Apple will enforce it in a future iOS version. Track
[facebook/react-native#53602](https://github.com/facebook/react-native/issues/53602)
for React Native's official adoption.

### react-native-keychain not working on iOS 26

**Symptom:** Keychain storage operations fail silently on iOS 26
devices/simulators.

**Tracked at:**
[oblador/react-native-keychain#771](https://github.com/oblador/react-native-keychain/issues/771)

**Impact:** This is critical for Freighter since all secure storage (keys,
seeds) goes through Keychain. If you're testing on iOS 26, verify that keychain
read/write operations work before merging auth or storage changes.

### WebView touch regression on iOS 26

**Symptom:** Some buttons inside `react-native-webview` are not clickable on
iOS 26. Device rotation temporarily restores touch functionality.

**Root cause:** This is an Apple-level bug affecting all WebView implementations
(including Flutter). Not a react-native-webview issue.

**Tracked at:**
[react-native-webview/react-native-webview#3920](https://github.com/react-native-webview/react-native-webview/issues/3920)

**Impact:** Affects WalletConnect dApp interactions that use WebView and any
in-app browser flows.

### TurboModule crash on iOS 26.1

**Symptom:** App crashes on startup with `performVoidMethodInvocation` SIGABRT.

**Tracked at:**
[facebook/react-native#54859](https://github.com/facebook/react-native/issues/54859)

**Impact:** If this affects your iOS 26.1 simulator/device, try updating to the
latest RN 0.81.x patch release.

### iOS 26 "Liquid Glass" visual changes

**Symptom:** Navigation bars, tab bars, toolbars, and alerts look different on
iOS 26 — translucent with a frosted glass effect — even though no code changed.

**Root cause:** iOS 26 introduced the "Liquid Glass" UIKit redesign (WWDC 2025).
All native UIKit components get this new appearance by default. Since
`react-native-screens` uses native `UINavigationController` under the hood, the
visual change propagates automatically.

**Impact:** Mostly cosmetic, but custom navigation bar styling may conflict with
the new defaults. Review the app's navigation headers and tab bar on an iOS 26
simulator to check for visual regressions. If needed, opt out of Liquid Glass on
specific views via UIKit appearance APIs.

## Android 16 (SDK 36) Compatibility Issues

### Edge-to-edge display is now mandatory

**Symptom:** App layout looks broken on Android 16 — content renders behind the
status bar or navigation bar.

**Root cause:** Android 16 (API 36) enforces edge-to-edge display with no
opt-out. React Native has deprecated `<SafeAreaView>` for this reason.

**Current status:** The project uses `SafeAreaView` in
`src/components/layout/BaseLayout.tsx` and
`src/components/TokensCollectiblesTabs.tsx`. These should be migrated to
`react-native-safe-area-context`'s `SafeAreaView` (which is edge-to-edge aware)
if not already.

**Reference:**
[Android 16 changes impacting React Native](https://github.com/react-native-community/discussions-and-proposals/discussions/921)

### Android 16 predictive back gesture

**Symptom:** Back navigation behaves unexpectedly — the system shows a preview
animation of the destination before committing, and custom `BackHandler` logic
may not fire as expected.

**Root cause:** Android 16 enables the predictive back gesture by default for
apps targeting SDK 36. The system intercepts back gestures to show a preview
animation before dispatching the back event.

**Impact:** React Navigation should handle this for standard screen transitions.
However, custom back handling (e.g., WalletConnect signing flows, transaction
confirmation modals, or any screen with `BackHandler.addEventListener`) should
be tested on Android 16 to ensure the back behavior is correct.

### Google Play 16KB page size requirement

**Symptom:** Google Play rejects APK/AAB uploads or shows compliance warnings
about 16KB page size support.

**Root cause:** Starting November 2025 (extended to May 2026), all apps
targeting Android 15+ must support 16KB page sizes. Native libraries (`.so`
files) must be aligned to 16KB boundaries.

**Current status:** The project has a patch for `react-native-fast-opencv` that
adds `ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON`
(`patches/react-native-fast-opencv+0.4.6.patch`). However, this flag is not
globally applied — other native libraries (especially
`react-native-vision-camera`, see
[mrousavy/react-native-vision-camera#3630](https://github.com/mrousavy/react-native-vision-camera/issues/3630))
may also need it.

**To verify compliance:**

```bash
# Check all .so files for 16KB alignment
python3 -c "
import subprocess, pathlib
for so in pathlib.Path('android').rglob('*.so'):
    result = subprocess.run(['file', str(so)], capture_output=True, text=True)
    print(f'{so.name}: {result.stdout.strip()}')"
```

## Dependency Compatibility Issues

These are known compatibility issues between the project's current package
versions.

### react-native-reanimated 4 migration notes

**Version:** 4.1.2 (current)

**Key changes from Reanimated 3:**

- Worklet scheduling moved to `react-native-worklets` (installed as 0.5.1)
- `useWorkletCallback` removed — use standard worklet callbacks
- `runOnJS` / `runOnUI` API changes may affect custom gesture handlers

**Known issue:** Some users report entire UI freezing after upgrading from v3 to
v4
([software-mansion/react-native-reanimated#8967](https://github.com/software-mansion/react-native-reanimated/issues/8967)).
If you encounter this, ensure `react-native-worklets` is properly linked and the
babel plugin is correct.

**Current babel config:** Uses `react-native-reanimated/plugin` in
`babel.config.js`. This should continue to work with Reanimated 4.1.x, but if
you encounter worklet compilation errors, check if migration to
`react-native-worklets/plugin` is needed per the
[migration guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/).

### @gorhom/bottom-sheet + Reanimated 4

**Version:** 5.2.6 (current)

**Status:** Compatible. Bottom-sheet 5.1.8+ is required for Reanimated 4
support. The project's 5.2.6 meets this requirement.

**If bottom-sheet becomes unresponsive:** This was a common issue with
bottom-sheet < 5.1.8 on Reanimated 4. If you see the sheet not opening or not
responding to gestures after a dependency update, verify that bottom-sheet
hasn't been downgraded below 5.1.8.

### NativeWind / react-native-css-interop + React 19

**Version:** NativeWind 4.1.23 with react-native-css-interop (patched)

**Known issues:**

- **Ref forwarding:** React 19 passes refs as props instead of the second
  argument. The project has a patch
  (`patches/react-native-css-interop+0.1.22.patch`) that fixes the `interop`
  function to forward `props.ref` correctly. If you update NativeWind or
  css-interop, verify this patch still applies.
- **CSS interop race condition:** NativeWind's CSS interop can cause a race
  condition with React Navigation, where utility classes trigger runtime CSS
  parsing during render and delay navigation context initialization
  ([nativewind/nativewind#1536](https://github.com/nativewind/nativewind/issues/1536)).
  If you see navigation-related crashes on app start, this may be the cause.
- **NativeWind v5 migration:** NativeWind v5 renames `react-native-css-interop`
  to `react-native-css` and makes it a peer dependency. When upgrading, the
  patch will need to be re-evaluated.

### react-native-vision-camera on Android 16

**Version:** 4.7.2 (current)

**Known issues:**

- **16KB page size compliance:** Google Play compliance warnings have been
  reported
  ([mrousavy/react-native-vision-camera#3630](https://github.com/mrousavy/react-native-vision-camera/issues/3630))
- **Camera blur on Android 16:** Reduced image quality reported on Pixel 7 and
  Samsung S24 Ultra running Android 16 after updating to vision-camera 4.7.2
  ([mrousavy/react-native-vision-camera#3676](https://github.com/mrousavy/react-native-vision-camera/issues/3676))
- **Kotlin compilation errors with RN 0.81:** Return type mismatches in
  `CameraViewManager.kt` and unresolved references in `CameraViewModule.kt`
  ([mrousavy/react-native-vision-camera#3601](https://github.com/mrousavy/react-native-vision-camera/issues/3601))

### react-native-screens + iOS 26

**Tracked at:**
[software-mansion/react-native-screens#3641](https://github.com/software-mansion/react-native-screens/issues/3641)

If you encounter navigation rendering glitches or crashes on iOS 26 simulators,
check this issue for compatibility fixes.

### Metro package exports + rn-nodeify conflict

**Symptom:** `Unable to resolve module` errors for `crypto`, `stream`, `buffer`,
or other Node.js polyfills after upgrading React Native or Metro.

**Root cause:** Metro 0.82+ (shipped with RN 0.79+) enables ES module
`"exports"` field resolution by default. This can conflict with `rn-nodeify`'s
module shimming since polyfilled packages may resolve to their real exports
instead of the shims.

**Current status:** The project already has this mitigated in `metro.config.js`
with `unstable_enablePackageExports: false` and a custom `resolveRequest`
function. **Do not remove this setting** — it is required for WalletConnect,
`stellar-sdk`, and crypto polyfills to resolve correctly.

**If you see polyfill resolution errors:** Check that `rn-nodeify` ran during
`postinstall` (it's in `package.json` postinstall script) and that
`metro.config.js` still disables package exports.

### CocoaPods version lockfile mismatch

**Symptom:** Warning: "The version of CocoaPods used to generate the lockfile
(1.16.2) is higher than the version of the current executable."

**Solution:** Ensure all team members use the same CocoaPods version:

```bash
gem install cocoapods -v 1.16.2    # Match the lockfile version
```

Or update the lockfile to match your installed version by running `pod install`
and committing the updated `Podfile.lock`.

## Known Issues & Active Development Areas

These are issues that have been encountered or are areas of active development.
Understanding them helps avoid re-introducing bugs or wasting time on known
causes.

### Blockaid asset scanning in search flow

**Status:** Active development (tracked as GitHub issue #210).

The asset search flow is being enhanced with Blockaid integration to flag
malicious assets. When working on the search/add-asset flow, be aware that scam
token detection is being built into this path. Red badges will appear on asset
icons when Blockaid flags them as malicious.

### WalletConnect session edge cases

**Known areas of complexity:**

- Session reconnection after app backgrounding — WalletConnect sessions can
  silently disconnect when the app is in the background too long
- Network mismatch — dApp may request signing on a different network than the
  user's active network. The app must validate this before processing.
- Duplicate response guard — Use `hasRespondedRef` to prevent sending duplicate
  WalletConnect responses on rapid approve/reject taps

**If you're debugging WalletConnect issues:**

1. Check `src/hooks/useWalletKitEventsManager.ts` for event listener setup
2. Check `src/providers/WalletKitProvider.tsx` for request handling
3. Use the mock dApp (`mock-dapp/`) for reproducible testing
4. Review `e2e/docs/walletconnect-e2e-testing.md` for the full test setup

### Minimum balance confusion (user-facing)

**Frequency:** Common user-reported issue. Users don't understand why they can't
send all their XLM.

**Root cause:** Stellar requires a minimum balance (1 XLM base + 0.5 XLM per
trustline/offer/signer). This XLM is locked and can't be sent.

**If you're working on the send flow:** The `calculateSpendableAmount()` helper
in the transaction amount screen already accounts for reserves. Ensure any
balance display clearly shows "available" vs "total" balance.

### Biometric auth after OS updates

**Known issue:** After iOS or Android OS updates, biometric authentication can
fail silently because the Keychain/Keystore access conditions changed.

**If you're working with biometric flows:** Always handle the fallback to PIN
gracefully. Test biometric flows after simulator/emulator OS version changes.

## Common Development Pitfalls

### Forgetting to test on both platforms

The PR template requires testing on both iOS and Android, including small
screens. React Native components can behave differently between platforms —
always test both before opening a PR.

### Using AsyncStorage for sensitive data

Never use `AsyncStorage` for private keys, seed phrases, or tokens. Use the
platform's secure storage (iOS Keychain / Android Keystore) via the appropriate
service in `src/services/`.

### Relative imports

The project enforces absolute imports from the `src/` root. ESLint will fail on
relative imports:

```typescript
// Wrong
import { something } from "../../helpers/something";

// Correct
import { something } from "helpers/something";
```

### Pre-commit hook is slow

The pre-commit hook runs `lint-staged` (ESLint + Prettier on staged files), the
full Jest test suite, and a TypeScript check. On large changesets this can take
minutes. This is intentional — it catches issues before they reach CI. If you
need to commit work-in-progress, the hooks still need to pass.

### Forgetting JSDoc

The PR template requires JSDoc on new functions and updated JSDoc on modified
functions. The codebase currently has very few JSDoc comments — help us improve
this by adding documentation as you work.
