import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { Provider } from "react-redux";
import { store } from "../config/store";
import { RootNavigator } from "../navigators/RootNavigator";
import { OfflineDetection } from "./OfflineDetection";

const App = (): React.JSX.Element => (
  <Provider store={store}>
    <NavigationContainer>
      <OfflineDetection>
        <RootNavigator />
      </OfflineDetection>
    </NavigationContainer>
  </Provider>
);

export default App;
