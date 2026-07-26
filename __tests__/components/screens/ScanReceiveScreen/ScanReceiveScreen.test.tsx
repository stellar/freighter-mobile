import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, fireEvent } from "@testing-library/react-native";
import ScanReceiveScreen from "components/screens/ScanReceiveScreen";
import { AnalyticsEvent, AnalyticsFlow } from "config/analyticsConfig";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { AppState, AppStateStatus } from "react-native";
import { track } from "services/analytics/core";

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN
>;

// Captures the props handed to ScanTabView on each render so the camera
// lifecycle wiring (cameraActive / isScanning) can be asserted. The real
// ScanTabView is stubbed out; we only care about the props it receives.
type ScanTabViewProps = { cameraActive: boolean; isScanning: boolean };
const mockScanTabViewProps: ScanTabViewProps[] = [];
const lastScanTabViewProps = (): ScanTabViewProps =>
  mockScanTabViewProps[mockScanTabViewProps.length - 1];

jest.mock("services/analytics/core", () => ({ track: jest.fn() }));
jest.mock("components/screens/ScanReceiveScreen/ScanTabView", () => {
  const { View: MockView } = jest.requireActual("react-native");
  return {
    ScanTabView: ({ cameraActive, isScanning }: ScanTabViewProps) => {
      mockScanTabViewProps.push({ cameraActive, isScanning });
      return <MockView testID="scan-tab-view" />;
    },
  };
});
jest.mock("components/screens/ScanReceiveScreen/ReceiveTabView", () => ({
  ReceiveTabView: () => null,
}));
jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      "scanReceiveScreen.scanTab": "Scan",
      "scanReceiveScreen.receiveTab": "Receive",
    };
    return map[key] || key;
  },
}));

const mockTrack = track as jest.Mock;
const mockGoBack = jest.fn();

const makeProps = (initialTab?: "scan" | "receive"): Props =>
  ({
    route: {
      params: initialTab ? { initialTab } : {},
      key: "scan-receive",
      name: ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN,
    },
    navigation: {
      goBack: mockGoBack,
      setParams: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    },
  }) as unknown as Props;

describe("ScanReceiveScreen", () => {
  const previousAppState = AppState.currentState;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScanTabViewProps.length = 0;
    // clearAllMocks resets recorded calls but keeps implementations; re-assert
    // the defaults so a test that flips focus/app-state doesn't leak.
    (useIsFocused as jest.Mock).mockReturnValue(true);
    (AppState as { currentState: string }).currentState = "active";
  });

  afterAll(() => {
    (AppState as { currentState: typeof previousAppState }).currentState =
      previousAppState;
  });

  // Per-tab views go out as the canonical screen.viewed event carrying the
  // tab's screen_name -- track() drops a VIEW_* slug passed as an event name.
  it("fires the scan view event by default", () => {
    renderWithProviders(<ScanReceiveScreen {...makeProps()} />);
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvent.SCREEN_VIEWED, {
      screen_name: AnalyticsEvent.VIEW_SCAN_QR_CODE,
      flow: AnalyticsFlow.ASSETS,
    });
  });

  it("fires the account-qr view event when opened on the receive tab", () => {
    renderWithProviders(<ScanReceiveScreen {...makeProps("receive")} />);
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvent.SCREEN_VIEWED, {
      screen_name: AnalyticsEvent.VIEW_ACCOUNT_QR_CODE,
      flow: AnalyticsFlow.ASSETS,
    });
  });

  it("fires the account-qr view event when switching to Receive", () => {
    const { getByText } = renderWithProviders(
      <ScanReceiveScreen {...makeProps("scan")} />,
    );
    mockTrack.mockClear();
    fireEvent.press(getByText("Receive"));
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvent.SCREEN_VIEWED, {
      screen_name: AnalyticsEvent.VIEW_ACCOUNT_QR_CODE,
      flow: AnalyticsFlow.ASSETS,
    });
  });

  it("never passes a VIEW_* slug to track() as an event name", () => {
    const { getByText } = renderWithProviders(
      <ScanReceiveScreen {...makeProps("scan")} />,
    );
    fireEvent.press(getByText("Receive"));
    mockTrack.mock.calls.forEach(([event]) => {
      expect(event).toBe(AnalyticsEvent.SCREEN_VIEWED);
    });
  });

  it("closes via goBack when the close button is pressed", () => {
    const { getByTestId } = renderWithProviders(
      <ScanReceiveScreen {...makeProps()} />,
    );
    fireEvent.press(getByTestId("scan-receive-close-button"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("does not mount the scanner until the Scan tab is visited", () => {
    // Opening straight to Receive must not mount the camera (no permission
    // prompt); the scanner mounts once Scan is selected and stays mounted.
    // includeHiddenElements checks mount state regardless of the a11y-hiding
    // applied to the inactive layer.
    const { queryByTestId, getByText } = renderWithProviders(
      <ScanReceiveScreen {...makeProps("receive")} />,
    );
    const scannerMounted = () =>
      queryByTestId("scan-tab-view", { includeHiddenElements: true }) !== null;
    expect(scannerMounted()).toBe(false);

    fireEvent.press(getByText("Scan"));
    expect(scannerMounted()).toBe(true);

    // Returning to Receive keeps the scanner mounted (camera kept warm).
    fireEvent.press(getByText("Receive"));
    expect(scannerMounted()).toBe(true);
  });

  it("mounts the scanner immediately when opened on the Scan tab", () => {
    const { queryByTestId } = renderWithProviders(
      <ScanReceiveScreen {...makeProps("scan")} />,
    );
    expect(queryByTestId("scan-tab-view")).not.toBeNull();
  });

  describe("camera lifecycle", () => {
    it("keeps the camera active and scanning on the Scan tab", () => {
      renderWithProviders(<ScanReceiveScreen {...makeProps("scan")} />);
      expect(lastScanTabViewProps()).toEqual({
        cameraActive: true,
        isScanning: true,
      });
    });

    it("keeps the camera warm but stops scanning behind the Receive tab", () => {
      // Camera stays alive (no blink on return) but scanning is gated off so
      // the live feed behind Receive cannot trigger a navigation.
      const { getByText } = renderWithProviders(
        <ScanReceiveScreen {...makeProps("scan")} />,
      );
      fireEvent.press(getByText("Receive"));
      expect(lastScanTabViewProps()).toEqual({
        cameraActive: true,
        isScanning: false,
      });
    });

    it("pauses the camera when the screen is not focused", () => {
      (useIsFocused as jest.Mock).mockReturnValue(false);
      renderWithProviders(<ScanReceiveScreen {...makeProps("scan")} />);
      expect(lastScanTabViewProps().cameraActive).toBe(false);
    });

    it("pauses the camera when the app is backgrounded and resumes on return", () => {
      renderWithProviders(<ScanReceiveScreen {...makeProps("scan")} />);
      expect(lastScanTabViewProps().cameraActive).toBe(true);

      const appStateHandlers = (
        AppState.addEventListener as jest.Mock
      ).mock.calls.map(
        ([, handler]) => handler as (state: AppStateStatus) => void,
      );

      // Simulate the app moving to the background.
      act(() => {
        appStateHandlers.forEach((handler) => handler("background"));
      });
      expect(lastScanTabViewProps().cameraActive).toBe(false);

      // Returning to the foreground resumes the camera.
      act(() => {
        appStateHandlers.forEach((handler) => handler("active"));
      });
      expect(lastScanTabViewProps().cameraActive).toBe(true);
    });
  });
});
