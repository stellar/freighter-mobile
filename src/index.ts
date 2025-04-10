/* eslint-disable @fnando/consistent-import/consistent-import */
import { App } from "components/App";
import { AppRegistry } from "react-native";

import { name as appName } from "../app.json";
import "../global.css";

AppRegistry.registerComponent(appName, () => App);
