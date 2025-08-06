import { Banner } from "components/sds/Banner";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("Banner", () => {
  const renderBanner = (props: React.ComponentProps<typeof Banner>) =>
    renderWithProviders(<Banner {...props} />);

  const defaultProps = {
    variant: "warning" as const,
    text: "Test banner message",
  };

  it("renders correctly with warning variant", () => {
    const { getByText } = renderBanner({
      ...defaultProps,
      variant: "warning",
    });

    expect(getByText("Test banner message")).toBeTruthy();
  });

  it("renders correctly with error variant", () => {
    const { getByText } = renderBanner({
      ...defaultProps,
      variant: "error",
    });

    expect(getByText("Test banner message")).toBeTruthy();
  });

  it("renders correctly with success variant", () => {
    const { getByText } = renderBanner({
      ...defaultProps,
      variant: "success",
    });

    expect(getByText("Test banner message")).toBeTruthy();
  });

  it("renders correctly with info variant", () => {
    const { getByText } = renderBanner({
      ...defaultProps,
      variant: "info",
    });

    expect(getByText("Test banner message")).toBeTruthy();
  });

  it("renders correctly without onPress", () => {
    const { getByText } = renderBanner(defaultProps);

    expect(getByText("Test banner message")).toBeTruthy();
  });

  it("renders correctly with onPress", () => {
    const mockOnPress = jest.fn();
    const { getByText } = renderBanner({
      ...defaultProps,
      onPress: mockOnPress,
    });

    expect(getByText("Test banner message")).toBeTruthy();
  });

  it("renders without chevron when showChevron is false", () => {
    const { getByText } = renderBanner({
      ...defaultProps,
      showChevron: false,
    });

    expect(getByText("Test banner message")).toBeTruthy();
  });

  it("renders with custom className", () => {
    const { getByText } = renderBanner({
      ...defaultProps,
      className: "custom-class",
    });

    expect(getByText("Test banner message")).toBeTruthy();
  });
});
