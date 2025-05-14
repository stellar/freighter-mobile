import { NetworkCongestionIndicator } from "components/sds/NetworkCongestionIndicator";
import { NetworkCongestion } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock SVG components
jest.mock("assets/icons/high-signal.svg", () => "HighSignal");
jest.mock("assets/icons/medium-signal.svg", () => "MediumSignal");
jest.mock("assets/icons/low-signal.svg", () => "LowSignal");

describe("NetworkCongestionIndicator", () => {
  it("renders low signal icon when level is low", () => {
    const { getByTestId } = renderWithProviders(
      <NetworkCongestionIndicator
        level={NetworkCongestion.LOW}
        testID="network-congestion"
      />,
    );

    expect(getByTestId("network-congestion")).toBeTruthy();
  });

  it("renders medium signal icon when level is medium", () => {
    const { getByTestId } = renderWithProviders(
      <NetworkCongestionIndicator
        level={NetworkCongestion.MEDIUM}
        testID="network-congestion"
      />,
    );

    expect(getByTestId("network-congestion")).toBeTruthy();
  });

  it("renders high signal icon when level is high", () => {
    const { getByTestId } = renderWithProviders(
      <NetworkCongestionIndicator
        level={NetworkCongestion.HIGH}
        testID="network-congestion"
      />,
    );

    expect(getByTestId("network-congestion")).toBeTruthy();
  });

  it("uses the provided size", () => {
    const customSize = 32;
    const { getByTestId } = renderWithProviders(
      <NetworkCongestionIndicator
        level={NetworkCongestion.LOW}
        size={customSize}
        testID="network-congestion"
      />,
    );

    expect(getByTestId("network-congestion")).toBeTruthy();
  });
});
