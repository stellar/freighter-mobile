/* eslint-disable @fnando/consistent-import/consistent-import */
/*
 * NOTE1: please keep this react-native-compat import at the top of the file
 * NOTE2: this returns a known error on Android:
 * "react-native-compat: Application module is not available", but it's safe to
 * ignore, and if you remove it the app will stop working
 */
import "@walletconnect/react-native-compat";
import { App } from "components/App";
import { isE2ETest } from "helpers/isEnv";
import { AppRegistry, LogBox } from "react-native";

import { name as appName } from "../app.json";
import "../global.css";

// Disable LogBox warnings during e2e tests to prevent banner from interfering with tests
if (isE2ETest) {
  LogBox.ignoreAllLogs(true);
}

AppRegistry.registerComponent(appName, () => App);
