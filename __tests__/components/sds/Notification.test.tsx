import { Notification } from "components/sds/Notification";
import { Text } from "components/sds/Typography";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { View } from "react-native";

describe("Notification", () => {
  const renderNotification = (
    props: React.ComponentProps<typeof Notification>,
  ) => renderWithProviders(<Notification {...props} />);

  const defaultProps = {
    variant: "success" as const,
    title: "Test Notification",
  };

  it("renders correctly with title only", () => {
    const { getByLabelText } = renderNotification(defaultProps);
    expect(getByLabelText("Test Notification")).toBeTruthy();
  });

  it("renders correctly with title and message", () => {
    const { getByLabelText, getByText } = renderNotification({
      ...defaultProps,
      message: "This is a test message",
    });

    expect(getByLabelText("Test Notification")).toBeTruthy();
    expect(getByText("This is a test message")).toBeTruthy();
  });

  it("renders with custom content", () => {
    const { getByText } = renderNotification({
      ...defaultProps,
      customContent: (
        <>
          <Text sm>Custom content</Text>
          <Text sm semiBold>
            More custom content
          </Text>
        </>
      ),
    });

    expect(getByText("Custom content")).toBeTruthy();
    expect(getByText("More custom content")).toBeTruthy();
  });

  it("renders with different variants", () => {
    const variants = [
      "primary",
      "secondary",
      "success",
      "error",
      "warning",
    ] as const;

    variants.forEach((variant) => {
      const { getByLabelText } = renderNotification({
        ...defaultProps,
        variant,
      });

      expect(getByLabelText("Test Notification")).toBeTruthy();
    });
  });

  it("renders as a button when onPress is provided", () => {
    const onPress = jest.fn();
    const { getByLabelText } = renderNotification({
      ...defaultProps,
      onPress,
    });

    expect(getByLabelText("Test Notification")).toBeTruthy();
  });

  it("renders with filled background", () => {
    const { getByLabelText } = renderNotification({
      ...defaultProps,
      isFilled: true,
    });

    expect(getByLabelText("Test Notification")).toBeTruthy();
  });

  it("renders with custom icon", () => {
    const { getByTestId } = renderNotification({
      ...defaultProps,
      icon: <View testID="custom-icon" />,
    });

    expect(getByTestId("custom-icon")).toBeTruthy();
  });
});
