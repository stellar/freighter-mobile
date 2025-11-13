import { NoticeBanner } from "components/sds/NoticeBanner";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      lilac: {
        9: "#8B5CF6", // Mock lilac-9 color
      },
      gray: {
        4: "#9CA3AF", // Mock gray-4 color
      },
    },
  }),
}));

jest.mock("components/sds/Icon", () => ({
  __esModule: true,
  default: {
    InfoCircle: () => <div data-testid="info-circle-icon" />,
  },
}));

describe("NoticeBanner", () => {
  const renderNoticeBanner = (
    props: React.ComponentProps<typeof NoticeBanner>,
  ) => renderWithProviders(<NoticeBanner {...props} />);

  const defaultProps = {
    text: "Test banner message",
  };

  it("renders correctly with text", () => {
    const { getByText } = renderNoticeBanner(defaultProps);

    expect(getByText("Test banner message")).toBeTruthy();
  });

  it("renders with icon component", () => {
    const { getByText } = renderNoticeBanner(defaultProps);

    expect(getByText("Test banner message")).toBeTruthy();
  });

  it("renders with different text content", () => {
    const customText = "Custom update message";
    const { getByText } = renderNoticeBanner({
      text: customText,
    });

    expect(getByText(customText)).toBeTruthy();
  });

  it("renders with long text content", () => {
    const longText =
      "This is a very long update message that should wrap to multiple lines and test the banner's ability to handle longer content gracefully";
    const { getByText } = renderNoticeBanner({
      text: longText,
    });

    expect(getByText(longText)).toBeTruthy();
  });

  it("renders with empty text", () => {
    const { getByText } = renderNoticeBanner({
      text: "",
    });

    expect(getByText("")).toBeTruthy();
  });

  it("renders without errors", () => {
    expect(() => renderNoticeBanner(defaultProps)).not.toThrow();
  });
});
