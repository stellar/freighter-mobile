/* eslint-disable @fnando/consistent-import/consistent-import */
// NOTE: please keep this react-native-compat import at the top of the file
import "@walletconnect/react-native-compat";
import { App } from "components/App";
import { AppRegistry } from "react-native";

import { name as appName } from "../app.json";
import "../global.css";

AppRegistry.registerComponent(appName, () => App);
