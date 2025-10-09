<a href="https://deepwiki.com/stellar/freighter-mobile"><img height="24" alt="Ask DeepWiki" src="https://deepwiki.com/badge.svg" /></a>
<a href="https://play.google.com/store/apps/details?id=org.stellar.freighterwallet"><img height="24" alt="Get app on Google Play" src="https://github.com/user-attachments/assets/67fa5ac5-b77e-4019-8bc0-4cc9d43dc69b" /></a>
<a href="https://apps.apple.com/app/freighter/id6743947720"><img height="24" alt="Get app on App Store" src="https://github.com/user-attachments/assets/2b002c9f-4ec5-49f2-8f4d-d04b7e4cd34a" /></a>

## Quick Start Dev Environment Setup

This guide will help you set up your development environment for Freighter
Mobile.

### Prerequisites

1.  **Node.js & Yarn:**

    - Install Node.js (LTS version recommended). You can download it from
      [nodejs.org](https://nodejs.org/).
    - Yarn is the recommended package manager. Install it via npm (which comes
      with Node.js):
      ```bash
        npm install --global yarn
      ```

2.  **Watchman (macOS only):**

    - Watchman is a tool by Facebook for watching changes in the filesystem. It
      is highly recommended for performance.
      ```bash
      brew install watchman
      ```

3.  **React Native CLI:**
    - Install the React Native command line interface:
      ```bash
      npm install --global react-native-cli
      ```
    - Alternatively, you might prefer to use `npx react-native <command>` for
      running commands without a global installation.

### Platform Specific Setup

Follow the official React Native documentation for setting up your environment
for iOS and Android development. This includes installing Xcode (for iOS) and
Android Studio (for Android), along with their respective SDKs and command-line
tools.

- Go to the
  [React Native development environment setup page](https://reactnative.dev/docs/environment-setup).
- Select **"React Native CLI Quickstart"**.
- Follow the instructions for your development OS (macOS, Windows, Linux) and
  target OS (iOS, Android).

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

    1. Create a `.env` file in the project root:

       ```bash
       touch .env
       ```

    2. Add the required environment variables:

       ```
       FREIGHTER_BACKEND_V1_PROD_URL=your_backend_v1_prod_url_here
       FREIGHTER_BACKEND_V2_PROD_URL=your_backend_v2_prod_url_here

       WALLET_KIT_PROJECT_ID=your_project_id_here
       WALLET_KIT_MT_NAME=your_wallet_name_here
       other variables...
       ```

    3. Update the `.env.example` file for documentation, add the same variables
       without values:

       ```
       FREIGHTER_BACKEND_V1_PROD_URL=
       FREIGHTER_BACKEND_V2_PROD_URL=

       WALLET_KIT_PROJECT_ID=
       WALLET_KIT_MT_NAME=
       other variables...
       ```

    **Important:**

    - Never commit the `.env` file to version control
    - Keep `.env.example` updated with any new environment variables
    - If you don't have the required environment variables, ask a team member
      for the values

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
