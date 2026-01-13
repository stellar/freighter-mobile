# E2E Testing with Maestro

This directory contains end-to-end (E2E) tests for freighter-mobile using
[Maestro](https://maestro.mobile.dev/).

## Overview

E2E tests validate critical user flows by running the app in a
simulator/emulator and simulating real user interactions. These tests help
ensure that core functionalities work correctly across app updates.

## Prerequisites

### 1. Install Maestro

Install Maestro CLI using Homebrew:

```bash
brew tap mobile-dev-inc/tap
brew install mobile-dev-inc/tap/maestro
```

Verify installation:

```bash
maestro --version
```

### 2. Environment Setup

Before running E2E tests, you need to:

1. Set `IS_E2E_TEST=true` in your `.env` file (this enables test-specific
   behaviors in the app)
2. Build the app for testing (see [Building the App](#building-the-app))

### 3. iOS Simulator

Ensure you have an iOS simulator available. You can list available simulators
with:

```bash
xcrun simctl list devices available
```

## Test Structure

Tests are organized in the `flows/` directory:

```
e2e/
├── config.yaml              # Maestro configuration
├── README.md                # This file
└── flows/
    └── onboarding/
        ├── CreateWallet.yaml    # Test for creating a new wallet
        └── ImportWallet.yaml    # Test for importing an existing wallet
```

## Building the App

Before running tests, you need to build the app:

```bash
# Build and run the dev build on iOS simulator
yarn ios-dev
```

Or build specifically for testing:

```bash
# Make sure IS_E2E_TEST=true is set in .env
yarn ios-dev
```

The app should be running in the simulator before executing tests.

## Running Tests

### Run All Tests

```bash
maestro test e2e/flows
```

### Run a Specific Test

```bash
# Run create wallet test
maestro test e2e/flows/onboarding/CreateWallet.yaml

# Run import wallet test
maestro test e2e/flows/onboarding/ImportWallet.yaml
```

### Run Tests with Specific Simulator

```bash
# List available simulators
xcrun simctl list devices available

# Run test on specific simulator
maestro test e2e/flows/onboarding/CreateWallet.yaml --device "iPhone 15 Pro"
```

## Test Data

The tests use the following test data:

- **Test Password**: `TestPassword123!`
- **Test Recovery Phrase** (for import tests):
  `mushroom uncover sail prevent spot theory work inflict arctic figure dish surround`

**⚠️ Important**: Never use these credentials in production or commit them with
real assets.

## Test Flows

### Create Wallet Flow

Tests the complete wallet creation flow:

1. Launch app and verify welcome screen
2. Tap "Create new wallet"
3. Enter and confirm password
4. View recovery phrase
5. Validate recovery phrase (3 rounds)
6. Enable biometrics (if available)
7. Verify home screen is displayed

### Import Wallet Flow

Tests the wallet import flow:

1. Launch app and verify welcome screen
2. Tap "I already have a wallet"
3. Enter and confirm password
4. Enter recovery phrase
5. Enable biometrics (if available)
6. Verify home screen is displayed

## Known Limitations

### Recovery Phrase Validation

The Create Wallet flow includes recovery phrase validation, which requires
selecting the correct word from a grid for 3 rounds. The current implementation
uses a simplified approach that may need refinement based on the actual word
selection UI.

### Biometrics

Biometric authentication is tested conditionally - if biometrics are available
on the device/simulator, the test will enable them. On simulators without
biometric capabilities, the test will skip this step.

## Troubleshooting

### Tests Fail to Start

- Ensure the app is built and running in the simulator
- Verify `IS_E2E_TEST=true` is set in your `.env` file
- Check that Maestro is installed correctly: `maestro --version`

### Element Not Found

- Verify that the app is on the expected screen
- Check that testIDs are correctly set in the component code
- Use `maestro test --debug` for more detailed output

### Timeout Errors

- Increase timeout values in the test flow if needed
- Ensure the simulator/emulator has sufficient resources
- Check that network requests (if any) complete successfully

### Biometric Prompts

If biometric prompts appear during testing:

- On simulators, you may need to manually approve biometric prompts
- The test flows include handling for system-level biometric prompts, but some
  may require manual intervention

## Adding New Tests

To add a new test:

1. Create a new YAML file in the appropriate directory under `flows/`
2. Follow the structure of existing test files
3. Use testIDs for reliable element identification
4. Document the test flow in comments
5. Update this README with information about the new test

Example test structure:

```yaml
appId: org.stellar.freighterdev
tags:
  - feature-name
---
- launchApp:
    clearState: true
    clearKeychain: true
- assertVisible:
    id: some-screen
- tapOn:
    id: some-button
# ... more test steps
```

## Best Practices

1. **Use testIDs**: Always use `testID` props on interactive elements for
   reliable test automation
2. **Clear State**: Use `clearState: true` and `clearKeychain: true` in
   `launchApp` for test isolation
3. **Timeouts**: Use appropriate timeouts for operations that may take time
   (network requests, animations)
4. **Conditional Flows**: Use `runFlow` with `when` conditions for optional
   steps (like biometrics)
5. **Documentation**: Add comments to explain complex test flows

## Resources

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Maestro GitHub](https://github.com/mobile-dev-inc/maestro)
- [Maestro Best Practices](https://maestro.mobile.dev/best-practices)
