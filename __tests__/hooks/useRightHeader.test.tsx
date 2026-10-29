import { render } from "@testing-library/react-native";
import Icon from "components/sds/Icon";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React from "react";

const mockSetOptions = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ setOptions: mockSetOptions, goBack: jest.fn() }),
}));

jest.mock("hooks/useColors", () => () => ({
  themeColors: { text: { primary: "#primary" } },
}));

type HeaderButtonOptions = Parameters<typeof useRightHeaderButton>[0];

const HeaderUser: React.FC<HeaderButtonOptions> = (options) => {
  useRightHeaderButton(options);
  return null;
};

/** Renders the header's right button as the stack header would. */
const renderHeaderRight = (options: HeaderButtonOptions) => {
  render(<HeaderUser {...options} />);
  const { headerRight } = mockSetOptions.mock.calls.at(-1)[0];
  return render(headerRight());
};

describe("useRightHeaderButton", () => {
  beforeEach(() => jest.clearAllMocks());

  it("draws the icon in the color it's given", () => {
    const header = renderHeaderRight({
      icon: Icon.ScanCircle,
      iconSize: 24,
      iconColor: "#secondary",
    });

    expect(header.UNSAFE_getByType(Icon.ScanCircle).props).toMatchObject({
      size: 24,
      color: "#secondary",
    });
  });

  it("names the button for screen readers", () => {
    const { getByTestId } = renderHeaderRight({
      icon: Icon.ScanCircle,
      accessibilityLabel: "Scan a QR code",
    });

    expect(getByTestId("header-button").props.accessibilityLabel).toBe(
      "Scan a QR code",
    );
  });
});
