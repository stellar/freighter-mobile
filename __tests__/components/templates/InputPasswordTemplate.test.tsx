import { fireEvent } from "@testing-library/react-native";
import InputPasswordTemplate from "components/templates/InputPasswordTemplate";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("components/sds/BiometricToggleButton", () => ({
  BiometricToggleButton: () => null,
}));

jest.mock("components/sds/Avatar", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ signInMethod: "password" }),
}));

describe("InputPasswordTemplate (Verify Password)", () => {
  it("asks for the password in the shared field, masked with its eye", () => {
    const { getByTestId, getByLabelText } = renderWithProviders(
      <InputPasswordTemplate
        publicKey="GABC"
        error={null}
        isLoading={false}
        handleContinue={jest.fn()}
      />,
    );

    expect(getByTestId("password-input").props.secureTextEntry).toBe(true);

    fireEvent.press(getByLabelText("Show password"));

    expect(getByTestId("password-input").props.secureTextEntry).toBe(false);
  });

  it("shows the error under the field", () => {
    const { getByText } = renderWithProviders(
      <InputPasswordTemplate
        publicKey="GABC"
        error="Invalid password"
        isLoading={false}
        handleContinue={jest.fn()}
      />,
    );

    expect(getByText("Invalid password")).toBeTruthy();
  });
});
