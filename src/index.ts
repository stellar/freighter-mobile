// The order is important here. shim must be imported first.
/* eslint-disable @fnando/consistent-import/consistent-import */
import { App } from "components/App";
import { AppRegistry } from "react-native";

import { name as appName } from "../app.json";
import "../shim";

AppRegistry.registerComponent(appName, () => App);
