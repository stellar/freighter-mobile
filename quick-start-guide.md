# Freighter Mobile — Quick Start Guide

Evaluate the contributor's machine against all prerequisites for Freighter
Mobile (React Native), install what's missing, and run the initial setup.

## Step 1: Check all prerequisites

Run every check below and collect results. Report all at once — don't stop at
the first failure.

For each tool, try the version command first. If it fails (e.g., sandbox
restrictions), fall back to `which <tool>` to confirm presence.

```bash
# Node.js >= 20
node --version 2>&1 || which node

# Corepack
corepack --version 2>&1 || which corepack

# Yarn 4.10.0
yarn --version 2>&1 || which yarn

# Homebrew
brew --version 2>&1 || which brew

# Ruby >= 2.6.10
ruby --version 2>&1 || which ruby

# Bundler
bundle --version 2>&1 || which bundle

# Watchman
watchman --version 2>&1 || which watchman

# JDK 17
java -version 2>&1 || which java

# nvm (needed for node version management)
if command -v nvm >/dev/null 2>&1 || test -d "$HOME/.nvm"; then echo "nvm found"; else echo "nvm missing"; fi

# Xcode CLI Tools (macOS)
xcode-select -p 2>&1

# CocoaPods >= 1.13 (not 1.15.0, not 1.15.1)
pod --version 2>&1 || which pod

# ANDROID_HOME set
echo "ANDROID_HOME=$ANDROID_HOME"

# Android SDK components
if [ -n "$ANDROID_HOME" ]; then
  sdkmanager_bin="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
  if [ -x "$sdkmanager_bin" ]; then
    sdkmanager_list="$("$sdkmanager_bin" --list 2>/dev/null)"
    printf '%s\n' "$sdkmanager_list" | grep -Eq "platforms;android-36([[:space:]]|$)" && echo "SDK Platform 36: OK" || echo "SDK Platform 36: MISSING"
    printf '%s\n' "$sdkmanager_list" | grep -Eq "build-tools;36\.0\.0([[:space:]]|$)" && echo "Build-Tools 36.0.0: OK" || echo "Build-Tools 36.0.0: MISSING"
    printf '%s\n' "$sdkmanager_list" | grep -Eq "ndk;28\.2\.13676358([[:space:]]|$)" && echo "NDK 28.2.13676358: OK" || echo "NDK 28.2.13676358: MISSING"
  else
    echo "sdkmanager not available — check Android Studio SDK Manager manually"
  fi
fi

# Maestro (optional — only needed for e2e tests)
maestro --version 2>&1 || which maestro || echo "not installed (optional)"
```

## Step 2: Present results

Show a clear summary with status for each tool:

```
Freighter Mobile — Prerequisites Check
========================================
  Node.js        v20.x.x        >= 20 required        OK
  Corepack       0.x.x          any                   OK
  Yarn           4.10.0         4.10.0 required       OK
  Homebrew       4.x.x          any                   OK
  Ruby           3.x.x          >= 2.6.10 required    OK
  Bundler        2.x.x          any                   OK
  Watchman       2024.x         any                   OK
  JDK            17.0.x         17 required           OK
  nvm            found          any                   OK
  Xcode CLI      /path          any                   OK
  CocoaPods      1.16.x         >= 1.13               OK
  ANDROID_HOME   /path/to/sdk   must be set           OK
  SDK Platform 36               -                     OK
  Build-Tools 36.0.0            -                     MISSING
  NDK 28.2.13676358             -                     MISSING
  Maestro        not found      optional              SKIP
```

## Step 3: Install missing tools

Present the missing tools grouped by auto-installable vs manual. Then ask the
user: "I can install [list] automatically. Want me to proceed?"

If the user confirms, **run the install commands** for each missing tool. After
each install, re-check the version to confirm it succeeded. If an install fails,
report the error and continue with the next tool.

If the user declines, skip to Step 4 and note the missing tools in the final
summary.

**Auto-installable (run after user confirms):**

- **Homebrew**:
  `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- **nvm**:
  `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash`
  — then source nvm before continuing:
  `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`
- **Node.js 20**: `nvm install 20`
- **Corepack + Yarn**:
  `corepack enable && corepack prepare yarn@4.10.0 --activate`
- **Watchman**: `brew install watchman` (macOS) or build from source on Linux
- **rbenv + Ruby**:
  `brew install rbenv && rbenv install 3.1.4 && rbenv global 3.1.4` (macOS) or
  use system package manager on Linux. **3.1.4 is the CI-validated version.**
- **Bundler**: `gem install bundler`
- **JDK 17**: `brew install openjdk@17` (macOS) or
  `sudo apt install openjdk-17-jdk` (Linux)
- **Maestro**: `brew install mobile-dev-inc/tap/maestro` (macOS) or
  `curl -Ls "https://get.maestro.mobile.dev" | bash` (Linux)
- **Android SDK components**:
  `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platforms;android-36" "build-tools;36.0.0" "ndk;28.2.13676358"`

**Manual — guide the user:**

- **Xcode** (macOS only): Install from Mac App Store, then:
  `xcode-select --install && sudo xcodebuild -license accept`
- **Android Studio**: Install from developer.android.com, then open SDK Manager
  for SDK 36 + Build-Tools 36.0.0 + NDK 28.2.13676358
- **ANDROID_HOME** — add to shell profile (choose the `ANDROID_HOME` line for
  your OS, comment out the others):
  ```bash
  # macOS
  export ANDROID_HOME=$HOME/Library/Android/sdk
  # Linux
  # export ANDROID_HOME=$HOME/Android/Sdk
  # Windows (Git Bash / WSL)
  # export ANDROID_HOME=$HOME/AppData/Local/Android/Sdk
  export PATH=$PATH:$ANDROID_HOME/emulator
  export PATH=$PATH:$ANDROID_HOME/tools
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  ```
- **JAVA_HOME** — macOS with Homebrew:
  `export JAVA_HOME=$(/usr/libexec/java_home -v 17)`. Linux: usually
  auto-configured by package manager.

## Step 4: Run initial setup

```bash
nvm install 20 && nvm use 20   # No .nvmrc — use explicit version
bundle install       # Ruby deps (Fastlane, CocoaPods — no separate pod install needed)
yarn install         # Node deps (postinstall handles Husky, polyfills, pods)
```

## Step 5: Configure environment

Check if `.env` exists. If not:

```bash
cp .env.example .env
```

Then read `.env` and check which required variables are empty. For each empty
required variable, tell the user the value or how to set it up:

| Variable                            | Value or setup                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FREIGHTER_BACKEND_V1_DEV_URL`      | Run your own backend from [stellar/freighter-backend](https://github.com/stellar/freighter-backend) and point this to your local instance                          |
| `FREIGHTER_BACKEND_V2_DEV_URL`      | Run your own backend from [stellar/freighter-backend-v2](https://github.com/stellar/freighter-backend-v2) and point this to your local instance                    |
| `WALLET_KIT_PROJECT_ID_DEV`         | Create free project at [dashboard.reown.com](https://dashboard.reown.com) (type: Wallet), copy Project ID                                                          |
| `WALLET_KIT_MT_NAME_DEV`            | Your project name from Reown dashboard                                                                                                                             |
| `WALLET_KIT_MT_DESCRIPTION_DEV`     | Your project description                                                                                                                                           |
| `WALLET_KIT_MT_URL_DEV`             | Your project URL                                                                                                                                                   |
| `WALLET_KIT_MT_ICON_DEV`            | Your project icon URL                                                                                                                                              |
| `WALLET_KIT_MT_REDIRECT_NATIVE_DEV` | Deep link scheme matching your dev bundle ID                                                                                                                       |
| `ANDROID_DEBUG_KEYSTORE_PASSWORD`   | `android` (default)                                                                                                                                                |
| `ANDROID_DEBUG_KEYSTORE_ALIAS`      | `androiddebugkey` (default)                                                                                                                                        |
| `ANDROID_DEV_KEYSTORE_PASSWORD`     | Generate: `mkdir -p android/keystores && keytool -genkey -v -keystore android/keystores/dev-release.keystore -alias dev -keyalg RSA -keysize 2048 -validity 10000` |
| `ANDROID_DEV_KEYSTORE_ALIAS`        | The alias from your keystore (e.g., `dev`)                                                                                                                         |

Skip any variable that already has a value.

## Step 6: Verify

```bash
yarn check            # TypeScript + ESLint + Prettier
yarn test             # Jest unit tests
```

If both pass, tell the user they're ready: `yarn ios` or `yarn android`.

If something fails, read the error and diagnose — common causes are missing env
vars, wrong SDK version, or stale pods/gradle cache.

## Step 7: Summary

At the end, produce a final summary:

```
Setup Complete
==============
  Installed: [list of tools installed]
  Configured: .env with X/Y required variables filled

  Manual action needed:
  - [ ] Create WalletConnect project at dashboard.reown.com and fill WALLET_KIT_* vars
  - [ ] Generate Android dev keystore and fill ANDROID_DEV_KEYSTORE_* vars

  Ready to run: yarn ios / yarn android
```
