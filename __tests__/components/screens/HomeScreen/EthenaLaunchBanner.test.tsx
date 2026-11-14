import { fireEvent, screen } from "@testing-library/react-native";
import { EthenaLaunchBanner } from "components/screens/HomeScreen/EthenaLaunchBanner";
import { pxValue } from "helpers/dimensions";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";
import { StyleSheet } from "react-native";

const styleOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe("EthenaLaunchBanner", () => {
  const onPress = jest.fn();
  const onDismiss = jest.fn();

  const renderBanner = () =>
    renderWithProviders(
      <EthenaLaunchBanner onPress={onPress} onDismiss={onDismiss} />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the title and subtitle", () => {
    renderBanner();

    expect(screen.getByText("Meet Ethena on Stellar")).toBeTruthy();
    expect(screen.getByText("USDe and sUSDe are now available.")).toBeTruthy();
  });

  it("opens the promo when tapped", () => {
    renderBanner();

    fireEvent.press(screen.getByTestId("ethena-launch-banner-open"));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses from the ✕ without opening the promo", () => {
    renderBanner();

    fireEvent.press(screen.getByTestId("ethena-launch-banner-dismiss"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("outlines the card in dark mode only", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("dark");
    renderBanner();
    expect(styleOf("ethena-launch-banner-outline")).toMatchObject({
      borderWidth: 1,
      borderColor: "#282828",
    });

    screen.unmount();
    jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
    renderBanner();
    expect(screen.queryByTestId("ethena-launch-banner-outline")).toBeNull();
  });

  it.each(["light", "dark"] as const)(
    "looks the same in %s mode otherwise",
    (scheme) => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);

      renderBanner();

      expect(styleOf("ethena-launch-banner")).toMatchObject({
        backgroundColor: "#070908",
      });
      expect(
        StyleSheet.flatten(
          screen.getByText("Meet Ethena on Stellar").props.style,
        ),
      ).toMatchObject({ color: "#ffffff" });
      expect(
        StyleSheet.flatten(
          screen.getByText("USDe and sUSDe are now available.").props.style,
        ),
      ).toMatchObject({ color: "#7e7e7e" });
    },
  );

  it("keeps its text clear of the ✕", () => {
    renderBanner();

    // The ✕ sits 13pt in from the card's edge and is 24pt wide; the text stops
    // 8pt short of it, inside the card's 16pt padding.
    expect(styleOf("ethena-launch-banner-text")).toMatchObject({
      marginRight: pxValue(13 + 24 + 8 - 16),
    });
  });
});
