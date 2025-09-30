import { View } from "react-native";

export const mockGestureHandler = (): void => {
  const MockView = View;
  jest.mock("react-native-gesture-handler", () => ({
    PanGestureHandler: MockView,
    GestureHandlerRootView: MockView,
    State: {},
    createNativeWrapper: MockView,
    TapGestureHandler: MockView,
  }));
};
