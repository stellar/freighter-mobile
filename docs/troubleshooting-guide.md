# Troubleshooting Guide: Freighter Mobile

_Last updated: 2026-04-08_

Common issues and solutions when developing Freighter Mobile.

## Setup Issues

### `yarn install` fails with native dependency errors

**Symptom:** Build errors related to `react-native-skia`,
`react-native-reanimated`, or other native modules.

**Solution:**

```bash
yarn reset-env                 # Clears node_modules and other generated state
yarn install                   # Reinstall JavaScript dependencies
yarn rebuild freighter-mobile  # Rebuild the app package
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

> **Note:** For routine `pod install` failures (version conflicts, missing
> specs), clean cache + reinstall is usually sufficient. Do **not** run
> `pod deintegrate` — it strips the entire CocoaPods integration and is not a
> recommended recovery step for this project.

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
4. Check that `ios/sentry.properties` exists (it is gitignored)

### Android build succeeds but app crashes on launch

**Symptom:** App installs but immediately crashes.

**Solution:**

1. Check `adb logcat` for the crash reason
2. Common cause: missing or invalid `.env` values
3. Check that `android/sentry.properties` exists (it is gitignored)
4. Try a clean build:

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

   > **Note:** For routine pod sync issues, clean cache + reinstall is
   > sufficient. Do **not** run `pod deintegrate`.

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
4. Use the dev scheme (`freighter-mobile-dev`)

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

### iOS simulator does not paste from Mac clipboard

**Symptom:** Copying text on your Mac (e.g. a test mnemonic, `.env` value, or
address) and pressing Cmd+V inside the iOS Simulator does nothing, or the paste
option is greyed out.

**Root cause:** Since Xcode 14, the simulator uses an isolated pasteboard by
default and does not automatically sync with the Mac clipboard. macOS 14+
(Sonoma) also shows a one-time permission prompt when the Simulator first
requests clipboard access — if dismissed, sync stops working silently.

**Solutions:**

1. **Enable automatic pasteboard sync (most common fix):** In the Simulator menu
   bar, go to **Edit > Automatically Sync Pasteboard**. This must be checked for
   Mac → Simulator paste to work. It resets per Simulator session.

2. **macOS permission was denied:** If you previously dismissed the _"Simulator
   would like to access your clipboard"_ system prompt, re-grant it:

   - Open **System Settings > Privacy & Security > Pasteboard** and confirm
     Simulator is allowed
   - If it doesn't appear there, quit and relaunch the Simulator — the prompt
     will reappear on next clipboard access

3. **Manual paste via menu:** Even without auto-sync, you can paste discrete
   values using the Simulator's **Edit > Paste** menu item (or Cmd+Shift+V),
   which pushes the current Mac clipboard into the simulator and pastes it in
   the focused field.

4. **Paste via simctl (scriptable):** Push a value directly to the simulator
   pasteboard from the terminal:
   ```bash
   xcrun simctl pasteboard sync booted
   ```
   Run this after copying on the Mac, then paste normally in the simulator.

## Dependency & Package Issues

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
(1.15.2) is higher than the version of the current executable."

**Solution:** Ensure all team members use the same CocoaPods version:

```bash
gem install cocoapods -v 1.15.2    # Match the lockfile version
```

Or update the lockfile to match your installed version by running `pod install`
and committing the updated `Podfile.lock`.
