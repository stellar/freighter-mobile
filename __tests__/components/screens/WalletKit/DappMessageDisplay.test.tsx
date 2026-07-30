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
});
