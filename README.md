<a href="https://deepwiki.com/stellar/freighter-mobile"><img height="24" alt="Ask DeepWiki" src="https://deepwiki.com/badge.svg" /></a>
<a href="https://play.google.com/store/apps/details?id=org.stellar.freighterwallet"><img height="24" alt="Get app on Google Play" src="https://github.com/user-attachments/assets/67fa5ac5-b77e-4019-8bc0-4cc9d43dc69b" /></a>
<a href="https://apps.apple.com/app/freighter/id6743947720"><img height="24" alt="Get app on App Store" src="https://github.com/user-attachments/assets/2b002c9f-4ec5-49f2-8f4d-d04b7e4cd34a" /></a>

## Quick Start Dev Environment Setup

This guide will help you set up your development environment for Freighter
Mobile.

### Prerequisites

- **Node.js** >= 20: [nodejs.org](https://nodejs.org/) or `nvm install 20`
- **Yarn** 4.10.0: `corepack enable && corepack prepare yarn@4.10.0 --activate`
- **Ruby** >= 2.6.10: [rbenv](https://github.com/rbenv/rbenv) or
  [rvm](https://rvm.io/)
- **Watchman**: `brew install watchman` (macOS)
- **JDK 17**: Required for Android builds
- **Xcode**: Latest stable (iOS, macOS only)
- **Android Studio**: SDK 36, Build-Tools 36.0.0, NDK 28.2.13676358

For the full list of prerequisites, environment variable setup, and LLM-assisted
quick setup, see [CONTRIBUTING.md](CONTRIBUTING.md).

### Platform Specific Setup

Follow the
[React Native Environment Setup](https://reactnative.dev/docs/set-up-your-environment)
guide for iOS and Android.

### Project Setup

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/stellar/freighter-mobile.git
    cd freighter-mobile
    ```

2.  **Install Dependencies:**

    ```bash
    yarn install
    ```

3.  **Environment Variables:**

    The project uses `react-native-config` for environment variables. You'll
    need to set up your environment variables before running the app:

    1. Copy the example file and fill in the required values:

       ```bash
       cp .env.example .env
       ```

       See [CONTRIBUTING.md](CONTRIBUTING.md#environment-variables) for the full
       list of required variables and how to obtain each value.

    **Important:**

    - Never commit the `.env` file to version control
    - Keep `.env.example` updated with any new environment variables
    - See [CONTRIBUTING.md](CONTRIBUTING.md#environment-variables) for how to
      obtain each variable (public endpoints, Reown dashboard, keystore
      generation)

**Important**

See [package.json](./package.json) for other useful scripts like more specific
clean/install commands.

### Running the App

The app supports two different bundle IDs for different environments:

- **Production**: `org.stellar.freighterwallet` (default)
- **Development**: `org.stellar.freighterdev`

**Run on Android:**

- **Development variant:**

  ```bash
  yarn android
  or
  yarn android-dev
  ```

- **Production variant:**
  ```bash
  yarn android-prod
  ```

**Run on iOS (macOS only):**

- **Development variant:**

  ```bash
  yarn ios
  or
  yarn ios-dev
  ```

- **Production variant:**
  ```bash
  yarn ios-prod
  ```

**Important**

- The Metro bundler should automatically launch in a separate terminal window
  while running the `yarn ios` or `yarn android` scripts. You can also launch
  Metro manually through the `yarn start` command if needed
- If you don't have an iOS simulator or Android emulator booted it will try to
  boot the most recent one available while running the `yarn ios` or
  `yarn android` scripts
- The development variant will have "Dev" in the app name to distinguish it from
  production

This should get you up and running with the Freighter Mobile app in your
development environment. If you encounter any issues, please refer to the React
Native documentation or open an issue in the repository.

## WalletConnect Mock dApp for Manual Testing

The mock-dapp server allows you to manually test WalletConnect features like
`stellar_signMessage` and `stellar_signXDR` without needing a full dApp. This is
useful for both automated e2e tests and manual testing during development.

### Setup

1. **Navigate to mock-dapp directory:**

   ```bash
   cd mock-dapp
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Create a `.env` file in the `mock-dapp` directory:

   ```bash
   cp .env.example .env
   ```

   Add your WalletConnect project ID:

   ```
   WALLET_KIT_PROJECT_ID=your_project_id_here
   PORT=3001
   ```

4. **Start the server:**

   ```bash
   npm start
   ```

   Or use the provided script from the e2e directory:

   ```bash
   ./e2e/scripts/start-mock-server.sh
   ```

The server will run on `http://localhost:3001` and provide endpoints for:

- Creating WalletConnect sessions
- Sending sign message requests
- Sending sign transaction requests
- Viewing session responses

For more details, see the mock-dapp [README](./mock-dapp/README.md).

To stop the server:

```bash
./e2e/scripts/stop-mock-server.sh
```

## Release Process

See [RELEASE.md](./RELEASE.md) for the full release lifecycle documentation,
including regular and emergency release flows, post-merge steps, and CI/CD
configuration.
