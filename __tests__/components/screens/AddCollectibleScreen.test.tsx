import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import AddCollectibleScreen from "components/screens/AddCollectibleScreen/AddCollectibleScreen";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

type AddCollectibleScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.ADD_COLLECTIBLE_SCREEN
>;

const mockNavigate = jest.fn();

const navigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
} as unknown as AddCollectibleScreenProps["navigation"];

const route = {
  params: undefined,
} as unknown as AddCollectibleScreenProps["route"];

describe("AddCollectibleScreen - Show hidden link", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("navigates to the hidden collectibles screen when the Show hidden link is pressed", () => {
    const { getByTestId } = renderWithProviders(
      <AddCollectibleScreen navigation={navigation} route={route} />,
    );

    fireEvent.press(getByTestId("add-collectible-show-hidden"));

    expect(mockNavigate).toHaveBeenCalledWith(
      ROOT_NAVIGATOR_ROUTES.HIDDEN_COLLECTIBLES_SCREEN,
    );
  });
});
