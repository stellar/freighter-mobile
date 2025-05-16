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

2.  **Install Dependencies:** `bash     yarn install     ` **Important** See
    [package.json](./package.json) for other useful scripts like more specific
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
