import { fireEvent } from "@testing-library/react-native";
import ImportSecretKeyScreen from "components/screens/ImportSecretKeyScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockImportSecretKey = jest.fn();
// Stable, as the store's actions are: the screen clears its error in an
// effect cleanup keyed on clearError, which a new function every render
// would re-run.
const mockClearError = jest.fn();
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    importSecretKey: mockImportSecretKey,
    isLoading: false,
    clearError: mockClearError,
  }),
}));

const renderScreen = () =>
  renderWithProviders(
    <ImportSecretKeyScreen
      navigation={{ reset: jest.fn() } as never}
      route={{} as never}
    />,
  );

describe("ImportSecretKeyScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("masks the secret key and the password, each with the shared eye", () => {
    const { getByTestId, getAllByLabelText } = renderScreen();

    expect(getByTestId("secret-key-input").props.secureTextEntry).toBe(true);
    expect(getByTestId("secret-key-password-input").props.secureTextEntry).toBe(
      true,
    );
    // Each eye says what it shows, so a screen reader doesn't call the secret
    // key a password.
    expect(getAllByLabelText("Show secret key")).toHaveLength(1);
    expect(getAllByLabelText("Show password")).toHaveLength(1);
  });

  it("asks for the acknowledgement with the shared checkbox", () => {
    const { getByTestId, getByText } = renderScreen();
    const checkbox = getByTestId("import-secret-key-aware-checkbox");

    expect(checkbox.props.accessibilityRole).toBe("checkbox");
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: false });

    fireEvent.press(
      getByText(
        "I'm aware Varial can't recover the imported secret key and storing it is my responsibility.",
      ),
    );

    expect(
      getByTestId("import-secret-key-aware-checkbox").props.accessibilityState,
    ).toMatchObject({ checked: true });
  });

  it("shows an invalid secret key under its field", () => {
    const { getByTestId, getByText } = renderScreen();

    fireEvent.changeText(getByTestId("secret-key-input"), "not-a-secret-key");
    fireEvent.changeText(getByTestId("secret-key-password-input"), "password1");
    fireEvent.press(getByTestId("import-secret-key-aware-checkbox"));
    fireEvent.press(getByText("Import Wallet"));

    expect(getByText("Invalid secret key")).toBeTruthy();
    expect(mockImportSecretKey).not.toHaveBeenCalled();
  });
});
