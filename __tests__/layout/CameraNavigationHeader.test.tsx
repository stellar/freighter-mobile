import CameraNavigationHeader from "components/layout/CameraNavigationHeader";
import { getNavigationHeaderPaddingTop } from "components/layout/CustomNavigationHeader";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const IPHONE_17_PRO_INSETS = { top: 62, bottom: 34, left: 0, right: 0 };

describe("CameraNavigationHeader", () => {
  beforeEach(() => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue(IPHONE_17_PRO_INSETS);
  });

  afterEach(() => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("puts its row where every other screen's navigation header does", () => {
    const { getByTestId } = renderWithProviders(
      <CameraNavigationHeader headerTitle="Scan to send" />,
    );

    expect(
      StyleSheet.flatten(getByTestId("camera-navigation-header").props.style),
    ).toMatchObject({
      paddingTop: getNavigationHeaderPaddingTop(IPHONE_17_PRO_INSETS.top),
      paddingHorizontal: 16,
    });
  });

  it("sets its title like the navigation header's", () => {
    const { getByText } = renderWithProviders(
      <CameraNavigationHeader headerTitle="Scan to send" />,
    );

    expect(
      StyleSheet.flatten(getByText("Scan to send").props.style),
    ).toMatchObject({ fontSize: 18, lineHeight: 26 });
  });
});
