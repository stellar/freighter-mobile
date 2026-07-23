import { render } from "@testing-library/react-native";
import { QRScanner } from "components/QRScanner";
import React from "react";

// Capture the onCodeScanned callback QRScanner registers so we can simulate a
// detection without a real camera.
let capturedOnCodeScanned: ((codes: { value: string }[]) => void) | undefined;

jest.mock("react-native-vision-camera", () => ({
  Camera: () => null,
  useCameraDevice: () => ({ id: "back" }),
  useCameraPermission: () => ({
    hasPermission: true,
    requestPermission: jest.fn(),
  }),
  useCodeScanner: (config: {
    onCodeScanned: (codes: { value: string }[]) => void;
  }) => {
    capturedOnCodeScanned = config.onCodeScanned;
    return config;
  },
}));

jest.mock("react-native-svg", () => ({
  Svg: "Svg",
  Defs: "Defs",
  Mask: "Mask",
  Rect: "Rect",
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => key,
}));

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({ themeColors: { gold: { 9: "#c8a600" } } }),
}));

describe("QRScanner scanEnabled gating", () => {
  beforeEach(() => {
    // A fixed, large "now" so the first scan is never suppressed by the
    // debounce (which compares against an initial timestamp of 0).
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2020-01-01T00:00:00Z"));
    capturedOnCodeScanned = undefined;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("processes a scan when scanEnabled is true", () => {
    const onRead = jest.fn();
    render(<QRScanner onRead={onRead} title="Scan" isActive scanEnabled />);

    capturedOnCodeScanned?.([{ value: "WC_URI" }]);

    expect(onRead).toHaveBeenCalledWith("WC_URI");
  });

  it("drops scans when scanEnabled is false without caching them", () => {
    const onRead = jest.fn();
    const { rerender } = render(
      <QRScanner onRead={onRead} title="Scan" isActive scanEnabled={false} />,
    );

    // Seen while disabled → ignored entirely.
    capturedOnCodeScanned?.([{ value: "GADDRESS" }]);
    expect(onRead).not.toHaveBeenCalled();

    // Re-enabling and seeing the SAME code must still fire — proving the
    // disabled detection was not added to the processed-codes cache.
    rerender(<QRScanner onRead={onRead} title="Scan" isActive scanEnabled />);
    capturedOnCodeScanned?.([{ value: "GADDRESS" }]);

    expect(onRead).toHaveBeenCalledWith("GADDRESS");
    expect(onRead).toHaveBeenCalledTimes(1);
  });
});
