/* eslint-disable @typescript-eslint/naming-convention */
import { fireEvent } from "@testing-library/react-native";
import {
  FooterNote,
  OnboardLayout,
  OnboardTitle,
} from "components/layout/OnboardLayout";
import { Text } from "components/sds/Typography";
import { getThemeColors } from "config/colors";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { ScrollView, StyleSheet } from "react-native";

describe("OnboardLayout", () => {
  it("renders children and title", () => {
    const { getByText } = renderWithProviders(
      <OnboardLayout title="Welcome">
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    expect(getByText("Welcome")).toBeTruthy();
    expect(getByText("Test Content")).toBeTruthy();
  });

  it("renders footer note text and the default footer button when no footer is provided", () => {
    const mockOnPressDefaultActionButton = jest.fn();
    const { getByText } = renderWithProviders(
      <OnboardLayout
        footerNoteText="Footer Note"
        onPressDefaultActionButton={mockOnPressDefaultActionButton}
        defaultActionButtonText="Default Button"
      >
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    // Verify that the footer note text is rendered.
    expect(getByText("Footer Note")).toBeTruthy();

    // Verify that the default action button is rendered with the correct text.
    const defaultButton = getByText("Default Button");
    expect(defaultButton).toBeTruthy();

    // Simulate button press and verify callback is invoked.
    fireEvent.press(defaultButton);
    expect(mockOnPressDefaultActionButton).toHaveBeenCalledTimes(1);
  });

  it("renders custom footer when footer prop is provided", () => {
    const { getByText, queryByText } = renderWithProviders(
      <OnboardLayout footer={<Text>Custom Footer</Text>}>
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    // Verify that the custom footer is rendered.
    expect(getByText("Custom Footer")).toBeTruthy();

    // The default footer button should not be rendered.
    expect(queryByText("Continue")).toBeNull();
  });

  it("sets the title in Funnel Sans with the Varial tracking", () => {
    const { getByText } = renderWithProviders(
      <OnboardLayout title="Set Password">
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    expect(
      StyleSheet.flatten(getByText("Set Password").props.style),
    ).toMatchObject({ fontFamily: "FunnelSans-Medium", letterSpacing: -1.28 });
  });

  it("renders a title node as given, so a screen can animate its title", () => {
    const { getByText } = renderWithProviders(
      <OnboardLayout title={<OnboardTitle>Recovery Phrase</OnboardTitle>}>
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    expect(
      StyleSheet.flatten(getByText("Recovery Phrase").props.style),
    ).toMatchObject({ fontFamily: "FunnelSans-Medium", letterSpacing: -1.28 });
  });

  it("sets a string description in secondary text under the title", () => {
    const { getByText } = renderWithProviders(
      <OnboardLayout title="Title" description="A description">
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    expect(
      StyleSheet.flatten(getByText("A description").props.style).color,
    ).toBe(getThemeColors("light").text.secondary);
  });

  it("renders a description node as given", () => {
    const { getByText } = renderWithProviders(
      <OnboardLayout title="Title" description={<Text>Rich description</Text>}>
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    expect(getByText("Rich description")).toBeTruthy();
  });

  it("sets a warning footer note in amber", () => {
    const { getByText } = renderWithProviders(
      <OnboardLayout footerNoteText="Careful" footerNoteTone="warning">
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    expect(StyleSheet.flatten(getByText("Careful").props.style).color).toBe(
      getThemeColors("light").amber[11],
    );
  });

  it("lets a screen that lays out its own footer set the note as the layout does", () => {
    const { getByText } = renderWithProviders(
      <FooterNote text="Careful" tone="warning" />,
    );

    expect(StyleSheet.flatten(getByText("Careful").props.style)).toMatchObject({
      color: getThemeColors("light").amber[11],
      textAlign: "center",
    });
  });

  it("renders no footer when footer is null", () => {
    const { queryByTestId } = renderWithProviders(
      <OnboardLayout footer={null}>
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    expect(queryByTestId("default-action-button")).toBeNull();
  });

  it("grows with its content rather than squeezing it, so a small screen with the keyboard up can scroll", () => {
    const { UNSAFE_getByType, getByTestId } = renderWithProviders(
      <OnboardLayout title="Title">
        <Text>Test Content</Text>
      </OnboardLayout>,
    );
    const scrollContent = StyleSheet.flatten(
      UNSAFE_getByType(ScrollView).props.contentContainerStyle,
    );
    const layout = StyleSheet.flatten(
      getByTestId("onboard-layout").props.style,
    );
    const content = StyleSheet.flatten(
      getByTestId("onboard-layout-content").props.style,
    );

    [scrollContent, layout, content].forEach((style) => {
      expect(style).toMatchObject({ flexGrow: 1 });
      expect(style.flex).toBeUndefined();
    });
  });
});
