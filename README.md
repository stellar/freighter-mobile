[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/stellar/freighter-mobile)

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
       FREIGHTER_BACKEND_URL=your_backend_url_here
       FREIGHTER_BACKEND_V2_URL=your_backend_v2_url_here

       WALLET_KIT_PROJECT_ID=your_project_id_here
       WALLET_KIT_MT_NAME=your_wallet_name_here
       other variables...
       ```

    3. Update the `.env.example` file for documentation, add the same variables
       without values:

       ```
       FREIGHTER_BACKEND_URL=
       FREIGHTER_BACKEND_V2_URL=

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

**Run on Android:**

- In a new terminal window, navigate to the project root and run:
  ```bash
  yarn android
  ```

**Run on iOS (macOS only):**

- In a new terminal window, navigate to the project root and run:
  ```bash
  yarn ios
  ```

**Important**

- in both cases it should prompt you to open a new terminal tab to run Metro
  bundler and that tab should be kept open while runing the app.
- if you don't have a emulator open it will try to open the first one available

This should get you up and running with the Freighter Mobile app in your
development environment. If you encounter any issues, please refer to the React
Native documentation or open an issue in the repository.
