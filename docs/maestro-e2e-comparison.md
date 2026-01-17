# Maestro E2E Test Configuration: Implementation vs Official Documentation

## Executive Summary

This document provides a comprehensive comparison between the current e2e test configuration implemented in the `freighter-mobile` repository and the official Maestro documentation. The analysis focuses on integration tests, CI environment setup, and GitHub Actions configuration for both iOS and Android platforms.

**Overall Assessment:** The implementation is **comprehensive and well-structured**, with most best practices from the official Maestro documentation properly implemented. The configuration goes beyond basic Maestro requirements with custom Metro bundler management and connection verification scripts.

---

## 1. Installation and Setup

### ✅ What's Implemented Correctly

**iOS (`.github/workflows/ios-e2e.yml`)**
- ✅ Maestro installation via official method: `curl -fsSL "https://get.maestro.mobile.dev" | bash`
- ✅ PATH configuration: `export PATH="$PATH:$HOME/.maestro/bin"`
- ✅ Version verification: `maestro --version`
- ✅ macOS runner (macos-26) for iOS Simulator support
- ✅ Node.js setup with caching
- ✅ Proper Xcode version management

**Android (`.github/workflows/android-e2e.yml`)**
- ✅ Maestro installation via official method
- ✅ PATH configuration
- ✅ Version verification
- ✅ Java 17 setup with Zulu distribution
- ✅ Android SDK and NDK configuration
- ✅ Node.js setup with caching

### 📋 Observations

The installation follows the official Maestro documentation exactly. No issues found.

**Reference:** Official Maestro docs recommend `curl -fsSL "https://get.maestro.mobile.dev" | bash` for installation, which is correctly implemented.

---

## 2. iOS Simulator Setup

### ✅ What's Implemented Correctly

**Simulator Booting:**
- ✅ Uses `futureware-tech/simulator-action@v4` - a recommended action for iOS Simulator management
- ✅ Specific device model: `iPhone 17 Pro`
- ✅ Specific OS version: `26.2`
- ✅ `erase_before_boot: true` - ensures clean state
- ✅ `wait_for_boot: true` - waits for simulator to be ready
- ✅ `shutdown_after_job: true` - proper cleanup

**App Installation:**
- ✅ Proper app bundle extraction from tarball
- ✅ Uses `xcrun simctl install` with device UDID
- ✅ Absolute path handling for app bundle
- ✅ Error handling with detailed diagnostics

**App Launch:**
- ✅ Uses `xcrun simctl launch` with device UDID and app ID
- ✅ Verification that app is installed before launch
- ✅ Proper wait time after launch for Metro connection

### 📋 Observations

The iOS Simulator setup is **excellent** and follows best practices:
- The use of `futureware-tech/simulator-action` is aligned with community recommendations found in Maestro documentation and examples
- Proper UDID management from the simulator action output
- Clean state management with `erase_before_boot`

**Note:** The official Maestro documentation mentions `maestro start-device --platform ios` as an option, but using a dedicated GitHub Action like `futureware-tech/simulator-action` is actually **superior** for CI environments as it provides better lifecycle management.

---

## 3. Android Emulator Setup

### ✅ What's Implemented Correctly

**Emulator Booting:**
- ✅ Uses `reactivecircus/android-emulator-runner@v2` - the **recommended** action in Maestro documentation
- ✅ API level: 33 (aligned with Maestro defaults)
- ✅ Architecture: x86_64 (optimal for CI)
- ✅ Hardware acceleration: KVM enabled
- ✅ Appropriate emulator options:
  - `-no-snapshot-save`
  - `-wipe-data`
  - `-no-window` (headless)
  - `-gpu swiftshader_indirect`
  - `-noaudio`
  - `-no-boot-anim`
  - `-accel on`
- ✅ Resource allocation: 4 cores, 4096MB RAM
- ✅ Animations disabled via `disable-animations: true`

**Boot Verification:**
- ✅ Custom verification step that waits for `sys.boot_completed`
- ✅ ADB connection verification
- ✅ Retry logic with appropriate timeouts (10 minutes for boot, 5 minutes for ADB)
- ✅ Device count validation

**App Installation:**
- ✅ Uses `adb install -r` for APK installation
- ✅ Error handling with diagnostics
- ✅ Package verification before launch

**App Launch:**
- ✅ Uses `adb shell am start` with proper intent flags
- ✅ Correct activity name: `org.stellar.freighterwallet.MainActivity`
- ✅ Proper intent action and category

**ADB Reverse Setup:**
- ✅ **Critical:** `adb reverse tcp:8081 tcp:8081` to connect emulator to Metro on host
- ✅ Proper error handling for adb reverse

### 📋 Observations

The Android Emulator setup is **comprehensive and robust**:
- The use of `reactivecircus/android-emulator-runner` is **exactly** what Maestro documentation recommends
- The custom boot verification is more thorough than basic Maestro examples
- The ADB reverse setup for Metro is **essential** for React Native and correctly implemented

**Reference:** Maestro docs explicitly recommend using `reactivecircus/android-emulator-runner` for Android on GitHub Actions, which is correctly implemented here.

---

## 4. Metro Bundler Setup

### ✅ What's Implemented Correctly (Both Platforms)

**Metro Startup:**
- ✅ Background process: `yarn start > /tmp/metro_output.log 2>&1 &`
- ✅ PID tracking: `METRO_PID=$!`
- ✅ Log file management for debugging
- ✅ Port availability check (8081)
- ✅ Health verification using `nc` or `lsof`
- ✅ Appropriate timeout (300 seconds)
- ✅ Fallback to multiple port checking methods

**Metro Connection Verification:**
- ✅ **Custom script:** `scripts/wait-for-metro-connection.sh` - **This is EXCELLENT**
- ✅ Monitors Metro logs for connection establishment
- ✅ Checks app process status (iOS: `launchctl list`, Android: `pidof`)
- ✅ Periodic status checks (every 30 seconds)
- ✅ **Auto-restart capability** if Metro doesn't connect after 8 minutes
- ✅ Platform-specific app relaunching after Metro restart
- ✅ Comprehensive error diagnostics

### 🌟 Beyond Official Documentation

The `wait-for-metro-connection.sh` script is a **significant enhancement** not found in basic Maestro documentation:
- Actively monitors Metro connection state
- Intelligently restarts Metro if connection fails
- Provides detailed diagnostics throughout the process
- Handles platform-specific quirks

**Official Maestro documentation** mentions that Metro should be running but doesn't provide detailed guidance on:
- How to verify Metro connection in CI
- How to handle Metro connection failures
- Auto-recovery mechanisms

The implementation here is **superior** to basic examples found in the wild.

---

## 5. Running Maestro Tests

### ✅ What's Implemented Correctly

**Test Execution:**
- ✅ Environment variables:
  - `IS_E2E_TEST="true"`
  - `MAESTRO_DISABLE_UPDATE_CHECK="true"`
  - `MAESTRO_CLI_NO_ANALYTICS="true"`
- ✅ Maestro availability verification
- ✅ Metro health check before tests
- ✅ Custom test runner: `scripts/run-e2e-tests.sh`
- ✅ Test output directory: `e2e-artifacts/`
- ✅ Individual test files in `e2e/flows/` directory structure

**Test Configuration:**
- ✅ `e2e/config.yaml` with platform-specific settings
- ✅ Animations disabled for both platforms
- ✅ Correct `appId: org.stellar.freighterdev`
- ✅ Proper test flow structure with tags

**Artifact Upload:**
- ✅ Test results uploaded with `if: always()`
- ✅ Metro logs uploaded for debugging
- ✅ Appropriate retention days (7 days for results, 2 days for builds)

### 📋 Observations

The test execution follows Maestro best practices:
- The `--test-output-dir` flag is properly used
- Test flows are organized in subdirectories (`flows/onboarding/`)
- Error handling is comprehensive

**Note:** The official Maestro documentation recommends running tests with:
```bash
maestro test e2e/flows
```

The implementation uses a custom script that iterates through YAML files, which is **equally valid** and provides more control over test execution order and failure handling.

---

## 6. Test Flow Structure

### ✅ What's Implemented Correctly

**Flow Configuration:**
- ✅ Proper `appId` declaration
- ✅ Use of tags for organization
- ✅ `launchApp` with `clearState: true` and `clearKeychain: true`
- ✅ `extendedWaitUntil` with generous timeouts (600 seconds for first launch)
- ✅ Proper use of `testID` selectors
- ✅ Conditional flows with `runFlow` and `when` clauses
- ✅ Keyboard management with `hideKeyboard`
- ✅ System dialog handling (biometrics)

### 📋 Observations

The test flows follow Maestro best practices:
- Using `testID` for reliable element selection (recommended by Maestro)
- Generous timeouts for first launch (React Native apps can be slow on first load)
- Proper state clearing for test isolation
- Conditional handling of optional features (biometrics)

**Reference:** The official Maestro docs emphasize using `testID` for React Native apps, which is correctly implemented.

---

## 7. CI/CD Best Practices

### ✅ What's Implemented Correctly

**Build Separation:**
- ✅ Separate `build` and `test` jobs
- ✅ Artifact passing between jobs
- ✅ Appropriate timeout values (120 minutes)

**Resource Management:**
- ✅ Disk space cleanup on Android
- ✅ Build artifact cleanup
- ✅ Gradle cache management
- ✅ Using 16-core runners for Android builds

**Caching:**
- ✅ Node.js cache via `actions/setup-node@v6`
- ✅ Ruby bundler cache
- ✅ Gradle cache
- ✅ CocoaPods cache

**Environment Configuration:**
- ✅ Comprehensive environment variables
- ✅ Disabled services for E2E (Sentry, Amplitude)
- ✅ Backend URLs configured
- ✅ Proper Android and iOS flavor/scheme selection

### 📋 Observations

The CI/CD setup is **enterprise-grade**:
- Proper job separation improves parallelization and failure isolation
- Resource management prevents out-of-disk-space errors
- Caching reduces CI run time

These practices **exceed** what's shown in basic Maestro documentation examples.

---

## 8. Areas Not Found in Current Implementation

### ⚠️ Optional/Advanced Features Not Implemented

Based on the official Maestro documentation review, the following features are **optional** but available:

1. **Maestro Cloud Integration** (Optional)
   - Current implementation: Tests run locally in CI runners
   - Maestro Cloud option: `mobile-dev-inc/action-maestro-cloud@v1`
   - **Assessment:** Local execution is perfectly valid and provides more control
   - **Recommendation:** Keep current approach unless scaling issues arise

2. **Maestro CLI Device Management** (Not Needed)
   - Maestro offers: `maestro start-device --platform ios/android`
   - Current implementation: Uses dedicated GitHub Actions
   - **Assessment:** Current approach is **superior** for CI environments

3. **Test Sharding** (Not Implemented)
   - Maestro offers: `maestro test --shard-split N`
   - Current implementation: Runs tests sequentially
   - **Assessment:** Not needed yet with only 2 test flows
   - **Recommendation:** Consider if test suite grows significantly (10+ tests)

4. **Facebook IDB for iOS** (May Not Be Needed)
   - Official docs mention: `brew install facebook/fb/idb-companion`
   - Current implementation: Uses `xcrun simctl` directly
   - **Assessment:** `idb` is for advanced iOS debugging; current approach is sufficient
   - **Recommendation:** Only add if troubleshooting iOS-specific issues

5. **Test Tags Filtering** (Available but Not Used)
   - Maestro offers: `--include-tags` / `--exclude-tags`
   - Current implementation: Runs all tests
   - **Assessment:** Tags are defined in flows but not used for filtering
   - **Recommendation:** Consider using if selective test execution is needed

6. **JUnit Report Generation** (Not Implemented)
   - Maestro offers: `--format=junit --output=report.xml`
   - Current implementation: Uses default output
   - **Assessment:** Would be useful for test result parsing in CI
   - **Recommendation:** Consider adding for better GitHub test result integration

---

## 9. Comparison with Maestro Official Examples

### Official GitHub Actions Example (Simplified)

**What Maestro Docs Show:**
```yaml
- uses: reactivecircus/android-emulator-runner@v2
  with:
    api-level: 29
    script: maestro test .maestro
```

**What This Implementation Does:**
- ✅ Uses the same `android-emulator-runner` action
- ✅ More detailed emulator configuration
- ✅ Separate boot verification step
- ✅ Metro bundler management
- ✅ Metro connection verification
- ✅ Separate app installation and launch steps
- ✅ More comprehensive error handling

**Assessment:** The implementation is **significantly more robust** than basic examples.

---

## 10. Missing Elements from Official Documentation

### 🟢 Nothing Critical is Missing

After thorough review of official Maestro documentation, **all critical elements are properly implemented**:

✅ Installation ✅ iOS Simulator Setup ✅ Android Emulator Setup ✅ App Building ✅ App Installation ✅ Metro Bundler (for React Native) ✅ Test Execution ✅ Artifact Collection

### 🔵 Optional Enhancements to Consider

1. **JUnit XML Reports**
   ```bash
   maestro test --format=junit --output=e2e-artifacts/report.xml e2e/flows
   ```
   - Would enable GitHub to show test results in the UI
   - Currently test output is text-only

2. **Maestro Studio for Flow Development** (Local Dev Only)
   ```bash
   maestro studio
   ```
   - Mentioned in docs for interactive flow development
   - Not needed in CI, but useful for developers

3. **Test Recording** (Optional)
   ```bash
   maestro test --record e2e/flows
   ```
   - Would create video recordings of test runs
   - Useful for debugging failures but increases artifact size

---

## 11. React Native Specific Considerations

### ✅ Properly Handled

The implementation correctly handles React Native-specific requirements:

1. **Metro Bundler is Running Before Tests**
   - ✅ Started in background
   - ✅ Port verification
   - ✅ Connection monitoring

2. **ADB Reverse for Android**
   - ✅ `adb reverse tcp:8081 tcp:8081`
   - Critical for React Native Metro connection

3. **First Launch Timeout**
   - ✅ `extendedWaitUntil` with 600-second timeout
   - React Native apps can take time to load initially

4. **App ID Configuration**
   - ✅ Correct app ID: `org.stellar.freighterdev`
   - ✅ Used in both workflow files and test flows

**Reference:** Official Maestro React Native docs emphasize these points, which are all correctly implemented.

---

## 12. Key Strengths of Current Implementation

### 🌟 Exceptional Features

1. **Custom Metro Connection Verification Script**
   - `scripts/wait-for-metro-connection.sh`
   - Auto-restart capability
   - Platform-specific handling
   - **Far exceeds basic Maestro examples**

2. **Comprehensive Boot Verification**
   - Goes beyond basic "wait for device"
   - Checks `sys.boot_completed` for Android
   - Verifies ADB connectivity with retries

3. **Excellent Error Diagnostics**
   - Detailed logging at each step
   - Metro log capture
   - Device status checks
   - Helpful error messages

4. **Production-Grade CI Setup**
   - Build/test job separation
   - Artifact management
   - Resource optimization
   - Appropriate caching strategies

5. **Clean State Management**
   - `clearState: true` and `clearKeychain: true` in test flows
   - `erase_before_boot: true` for iOS
   - `-wipe-data` for Android
   - Ensures test isolation

---

## 13. Recommendations

### ✅ Keep as Is

The following aspects are excellent and should not be changed:
- Metro bundler management
- Custom connection verification script
- Boot verification logic
- Build/test job separation
- Error handling and diagnostics
- Test flow structure

### 🔵 Optional Enhancements

1. **Add JUnit XML Report Generation**
   ```bash
   maestro test --format=junit --output=e2e-artifacts/report.xml e2e/flows
   ```
   Update `scripts/run-e2e-tests.sh`:
   ```bash
   maestro test --format=junit --output="$OUTPUT_DIR/junit.xml" e2e/flows
   ```

2. **Consider Test Recording for Debugging** (Optional)
   Only enable on failure to keep artifact size manageable:
   ```yaml
   - name: Run E2E tests with recording
     if: failure()
     run: maestro test --record e2e/flows
   ```

3. **Add Test Suite Summary** (Optional)
   Use GitHub Actions summary for better visibility:
   ```bash
   echo "## E2E Test Results" >> $GITHUB_STEP_SUMMARY
   echo "✅ All tests passed" >> $GITHUB_STEP_SUMMARY
   ```

4. **Document Maestro Studio Usage** (Developer Experience)
   Add to `e2e/README.md`:
   ```markdown
   ## Developing New Test Flows
   
   Use Maestro Studio for interactive flow development:
   \`\`\`bash
   maestro studio
   \`\`\`
   ```

---

## 14. Conclusion

### Overall Assessment: **EXCELLENT** ✅

The e2e test configuration in the `freighter-mobile` repository is **comprehensive, robust, and follows all best practices** from the official Maestro documentation. In many areas, it **exceeds** what's shown in basic examples:

**Strengths:**
- ✅ All critical Maestro requirements properly implemented
- ✅ Superior Metro bundler management
- ✅ Excellent error handling and diagnostics
- ✅ Production-grade CI/CD practices
- ✅ Clean test isolation
- ✅ Comprehensive device management

**Nothing Critical is Missing:**
- All essential setup steps are present
- Both iOS and Android properly configured
- Metro bundler correctly integrated
- Tests properly structured

**Optional Enhancements Available:**
- JUnit XML reports (for GitHub UI integration)
- Test recording (for debugging)
- Test sharding (if test suite grows)
- Maestro Cloud (for scaling, not needed now)

### Final Verdict

The implementation is **production-ready** and demonstrates a **deep understanding** of both Maestro and React Native testing requirements. The custom Metro connection verification script and comprehensive boot verification logic go **beyond** what's shown in official documentation and represent **best-in-class** mobile CI/CD practices.

**No changes are required** to meet Maestro documentation standards. The suggested enhancements are purely optional and should be considered based on specific needs (e.g., add JUnit reports if GitHub test result UI is desired).

---

## References

1. **Maestro Official Documentation**
   - Installation: https://docs.maestro.dev/getting-started/installing-maestro
   - Running on CI: https://docs.maestro.dev/getting-started/running-flows-on-ci
   - GitHub Actions: https://docs.maestro.dev/cloud/ci-integration/github-actions
   - React Native Support: https://docs.maestro.dev/platform-support/react-native
   - iOS Platform: https://docs.maestro.dev/platform-support/ios
   - Android Platform: https://docs.maestro.dev/platform-support/android

2. **Recommended GitHub Actions**
   - Android Emulator: https://github.com/ReactiveCircus/android-emulator-runner
   - iOS Simulator: https://github.com/futureware-tech/simulator-action

3. **Current Implementation**
   - iOS Workflow: `.github/workflows/ios-e2e.yml`
   - Android Workflow: `.github/workflows/android-e2e.yml`
   - Test Runner: `scripts/run-e2e-tests.sh`
   - Metro Connection: `scripts/wait-for-metro-connection.sh`
   - Test Flows: `e2e/flows/`

---

**Document Version:** 1.0
**Date:** 2026-01-17
**Author:** GitHub Copilot Analysis
