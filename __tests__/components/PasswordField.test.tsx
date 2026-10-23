/* eslint-disable @typescript-eslint/naming-convention */
import { fireEvent } from "@testing-library/react-native";
import { PasswordField } from "components/PasswordField";
import Icon from "components/sds/Icon";
import { renderWithProviders } from "helpers/testUtils";
import React, { createRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

const Harness: React.FC<{ error?: string | null }> = ({ error }) => {
  const [value, setValue] = useState("");

  return (
    <PasswordField
      testID="password"
      value={value}
      onChangeText={setValue}
      placeholder="Password"
      note="Must be at least 8 characters long"
      error={error}
    />
  );
};

describe("PasswordField", () => {
  it("masks the password and shows the slashed eye", () => {
    const { getByTestId, UNSAFE_getByType } = renderWithProviders(<Harness />);

    expect(getByTestId("password").props.secureTextEntry).toBe(true);
    expect(UNSAFE_getByType(Icon.EyeOff)).toBeTruthy();
  });

  it("shows the password from the eye, and names the button for screen readers", () => {
    const { getByTestId, getByLabelText, UNSAFE_getByType } =
      renderWithProviders(<Harness />);

    fireEvent.press(getByLabelText("Show password"));

    expect(getByTestId("password").props.secureTextEntry).toBe(false);
    expect(UNSAFE_getByType(Icon.Eye)).toBeTruthy();
    expect(getByLabelText("Hide password")).toBeTruthy();
  });

  // Shown, it's a plain text field, so the password can be edited anywhere:
  // an iOS secure field keeps the caret at the end and wipes its text when
  // typed into again. Leaving secure entry makes iOS swap the keyboard's
  // Passwords bar for its suggestions, an accepted cost.
  it("lets the shown password be edited like any text", () => {
    const { getByTestId } = renderWithProviders(<Harness />);

    fireEvent.changeText(getByTestId("password"), "secret123");
    fireEvent.press(getByTestId("password-visibility-button"));

    expect(getByTestId("password").props.secureTextEntry).toBe(false);
    expect(getByTestId("password").props.caretHidden).not.toBe(true);

    fireEvent.changeText(getByTestId("password"), "secre123");
    expect(getByTestId("password").props.value).toBe("secre123");
  });

  it("sets the masked dots at 24pt, the placeholder and shown text at 16pt", () => {
    const { getByTestId } = renderWithProviders(<Harness />);
    const font = () => StyleSheet.flatten(getByTestId("password").props.style);

    expect(font().fontSize).toBe(16);

    fireEvent.changeText(getByTestId("password"), "secret123");
    expect(font()).toMatchObject({ fontSize: 24, letterSpacing: -0.96 });

    fireEvent.press(getByTestId("password-visibility-button"));
    expect(font().fontSize).toBe(16);
  });

  it("shows an error in place of the note", () => {
    const { getByText, queryByText } = renderWithProviders(
      <Harness error="Passwords don't match" />,
    );

    expect(getByText("Passwords don't match")).toBeTruthy();
    expect(queryByText("Must be at least 8 characters long")).toBeNull();
  });

  it("shows Varial's focus ring while focused", () => {
    const { getByTestId } = renderWithProviders(<Harness />);
    const ring = () =>
      StyleSheet.flatten(getByTestId("password-focus-ring").props.style);

    fireEvent(getByTestId("password"), "focus");
    expect(ring().borderColor).toBe("rgba(143, 143, 143, 0.12)");

    fireEvent(getByTestId("password"), "blur");
    expect(ring().borderColor).toBe("transparent");
  });

  it("names the eye for what the field holds", () => {
    const { getByLabelText, queryByLabelText } = renderWithProviders(
      <PasswordField
        testID="secret-key"
        value=""
        onChangeText={jest.fn()}
        placeholder="Your secret key"
        visibilityLabels={{ show: "Show secret key", hide: "Hide secret key" }}
      />,
    );

    expect(queryByLabelText("Show password")).toBeNull();
    fireEvent.press(getByLabelText("Show secret key"));
    expect(getByLabelText("Hide secret key")).toBeTruthy();
  });

  it("lets a screen put its own control in place of the eye", () => {
    const { getByTestId, queryByLabelText } = renderWithProviders(
      <PasswordField
        testID="password"
        value=""
        onChangeText={jest.fn()}
        placeholder="Password"
        rightElement={<View testID="biometrics-button" />}
      />,
    );

    expect(getByTestId("biometrics-button")).toBeTruthy();
    expect(queryByLabelText("Show password")).toBeNull();
  });

  it("shows a label above the field and can focus on mount", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <PasswordField
        testID="password"
        value=""
        onChangeText={jest.fn()}
        placeholder="Enter your password"
        label="Password"
        autoFocus
      />,
    );

    expect(getByText("Password")).toBeTruthy();
    expect(getByTestId("password").props.autoFocus).toBe(true);
  });

  it("hands its input to a ref, so a form can move focus to it", () => {
    const ref = createRef<TextInput>();
    renderWithProviders(
      <PasswordField
        ref={ref}
        value=""
        onChangeText={jest.fn()}
        placeholder="Password"
      />,
    );

    expect(ref.current).toBeTruthy();
  });
});
