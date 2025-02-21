import { NavigationContainer } from "@react-navigation/native";
import { OfflineDetection } from "components/OfflineDetection";
import { store } from "config/store";
import { RootNavigator } from "navigators/RootNavigator";
import React from "react";
import { Provider } from "react-redux";

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
