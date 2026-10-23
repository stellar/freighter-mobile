import { userEvent } from "@testing-library/react-native";
import { getSetPasswordScreenOptions } from "helpers/navigationOptions";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { View } from "react-native";

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

describe("getSetPasswordScreenOptions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("slides create's Set Password up from the bottom, with an X back to Welcome", async () => {
    const options = getSetPasswordScreenOptions({
      route: { params: { isImporting: false } },
    });

    expect(options.animation).toBe("slide_from_bottom");

    const { getByLabelText } = renderWithProviders(
      <View>{options.headerLeft?.({ canGoBack: true } as never)}</View>,
    );
    await userEvent.press(getByLabelText("Close"));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("keeps the stack's side slide and back arrow for import's Set Password", () => {
    expect(
      getSetPasswordScreenOptions({ route: { params: { isImporting: true } } }),
    ).toEqual({});
  });
});
