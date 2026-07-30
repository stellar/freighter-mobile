import { DappMessageDisplay } from "components/screens/WalletKit/DappMessageDisplay";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Dimensions, StyleSheet } from "react-native";

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

describe("DappMessageDisplay", () => {
  it("renders the message content", () => {
    const { getByTestId } = renderWithProviders(
      <DappMessageDisplay message="hello world" />,
    );

    expect(getByTestId("message-display-content")).toHaveTextContent(
      "hello world",
    );
  });

  it("pretty-prints JSON messages", () => {
    const { getByTestId } = renderWithProviders(
      <DappMessageDisplay message='{"a":1}' />,
    );

    expect(getByTestId("message-display-content").props.children).toBe(
      JSON.stringify({ a: 1 }, null, 2),
    );
  });

  it("bounds the message scroll area so long messages cannot push the action buttons off-screen", () => {
    const { getByTestId } = renderWithProviders(
      <DappMessageDisplay message={"x".repeat(10000)} />,
    );

    const scrollView = getByTestId("message-display-content-scroll");
    const style = StyleSheet.flatten(scrollView.props.style);

    expect(style.maxHeight).toBeDefined();
    expect(style.maxHeight).toBeLessThanOrEqual(
      Dimensions.get("window").height * 0.5,
    );
  });

  it("can shrink below the cap (with a usable floor) when the sheet needs the room", () => {
    // With a security banner + stacked warning buttons the sheet's fixed
    // content grows; the message box must yield height so the action buttons
    // stay on screen, while keeping a scrollable sliver of the message.
    const { getByTestId } = renderWithProviders(
      <DappMessageDisplay message={"x".repeat(10000)} />,
    );

    const boxStyle = StyleSheet.flatten(
      getByTestId("message-display").props.style,
    );
    const scrollStyle = StyleSheet.flatten(
      getByTestId("message-display-content-scroll").props.style,
    );

    expect(boxStyle.flexShrink).toBe(1);
    expect(scrollStyle.flexShrink).toBe(1);
    expect(scrollStyle.minHeight).toBeGreaterThan(0);
  });
});
