import { NavigationContainer } from "@react-navigation/native";
import { OfflineDetection } from "components/OfflineDetection";
import { store } from "config/store";
import { RootNavigator } from "navigators/RootNavigator";
import React, { useCallback } from "react";
import RNBootSplash from "react-native-bootsplash";
import { Provider } from "react-redux";

export const App = (): React.JSX.Element => {
  const onReady = useCallback(() => {
    // We can bypass the eslint rule here because we need to hide the splash screen
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    RNBootSplash.hide({ fade: true });
  }, []);

  return (
    <Provider store={store}>
      <NavigationContainer onReady={onReady}>
        <OfflineDetection>
          <RootNavigator />
        </OfflineDetection>
      </NavigationContainer>
    </Provider>
  );
};
