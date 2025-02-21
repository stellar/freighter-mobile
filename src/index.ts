import App from "components/App";
import { AppRegistry } from "react-native";

// eslint-disable-next-line @fnando/consistent-import/consistent-import
import { name as appName } from "../app.json";

AppRegistry.registerComponent(appName, () => App);
