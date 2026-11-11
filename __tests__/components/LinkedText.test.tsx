import { fireEvent, act } from "@testing-library/react-native";
import { LinkedText } from "components/LinkedText";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Linking } from "react-native";

describe("LinkedText", () => {
  it("renders plain text with no links untouched", () => {
    const { getByText } = renderWithProviders(
      <LinkedText md>just plain text</LinkedText>,
    );
    expect(getByText("just plain text")).toBeTruthy();
  });

  it("opens the target URL when a markdown-style link is pressed", async () => {
    const { getByText } = renderWithProviders(
      <LinkedText md>
        {"See the [docs](https://example.com/docs) now."}
      </LinkedText>,
    );

    const link = getByText("docs");
    expect(link.props.accessibilityRole).toBe("link");

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      fireEvent.press(link);
    });

    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com/docs");
  });

  it("opens the URL when a bare https:// link is pressed", async () => {
    const { getByText } = renderWithProviders(
      <LinkedText md>{"Visit https://example.com/x today"}</LinkedText>,
    );

    const link = getByText("https://example.com/x");
    expect(link.props.accessibilityRole).toBe("link");

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      fireEvent.press(link);
    });

    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com/x");
  });
});
