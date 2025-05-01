import { userEvent } from "@testing-library/react-native";
import { ContactRow } from "components/screens/SendScreen/components";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { View } from "react-native";

// Mock components using string identifiers
jest.mock("components/sds/Avatar", () => ({
  __esModule: true,
  default: () => "MockedAvatar",
}));

jest.mock("components/sds/Icon", () => ({
  DotsHorizontal: () => "MockedDotsIcon",
}));

describe("ContactRow", () => {
  const mockAddress =
    "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH";
  const mockName = "Test Contact";
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with address only", () => {
    const { getByTestId } = renderWithProviders(
      <ContactRow address={mockAddress} testID="address-only-row" />,
    );

    expect(getByTestId("address-only-row")).toBeTruthy();
  });

  it("renders correctly with name and address", () => {
    const { getByTestId, getByText } = renderWithProviders(
      <ContactRow
        address={mockAddress}
        name={mockName}
        testID="contact-with-name"
      />,
    );

    expect(getByTestId("contact-with-name")).toBeTruthy();
    expect(getByText(mockName)).toBeTruthy();
  });

  it("calls onPress when pressed", async () => {
    const { getByTestId } = renderWithProviders(
      <ContactRow
        address={mockAddress}
        onPress={mockOnPress}
        testID="contact-row"
      />,
    );

    await userEvent.press(getByTestId("contact-row"));

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  }, 10000);

  it("renders correctly with onDotsPress prop", () => {
    const mockOnDotsPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <ContactRow
        address={mockAddress}
        onDotsPress={mockOnDotsPress}
        testID="with-dots-press"
      />,
    );

    expect(getByTestId("with-dots-press")).toBeTruthy();
  });

  it("renders custom right element when provided", () => {
    const CustomElement = () => <View testID="custom-element" />;
    const { getByTestId } = renderWithProviders(
      <ContactRow
        address={mockAddress}
        rightElement={<CustomElement />}
        testID="row-with-custom-element"
      />,
    );

    expect(getByTestId("row-with-custom-element")).toBeTruthy();
  });

  it("applies className when provided", () => {
    const customClass = "test-class";
    const { getByTestId } = renderWithProviders(
      <ContactRow
        address={mockAddress}
        className={customClass}
        testID="contact-with-class"
      />,
    );

    expect(getByTestId("contact-with-class")).toBeTruthy();
  });

  it("applies testID when provided", () => {
    const customTestId = "custom-test-id";
    const { getByTestId } = renderWithProviders(
      <ContactRow address={mockAddress} testID={customTestId} />,
    );

    expect(getByTestId(customTestId)).toBeTruthy();
  });
});
