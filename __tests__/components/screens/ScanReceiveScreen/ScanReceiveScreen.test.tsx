import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import ScanReceiveScreen from "components/screens/ScanReceiveScreen";
import { AnalyticsEvent } from "config/analyticsConfig";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { track } from "services/analytics/core";

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN
>;

jest.mock("services/analytics/core", () => ({ track: jest.fn() }));
jest.mock("components/screens/ScanReceiveScreen/ScanTabView", () => ({
  ScanTabView: () => null,
}));
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fires the scan view event by default", () => {
    renderWithProviders(<ScanReceiveScreen {...makeProps()} />);
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvent.VIEW_SCAN_QR_CODE);
  });

  it("fires the account-qr view event when opened on the receive tab", () => {
    renderWithProviders(<ScanReceiveScreen {...makeProps("receive")} />);
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvent.VIEW_ACCOUNT_QR_CODE);
  });

  it("fires the account-qr view event when switching to Receive", () => {
    const { getByText } = renderWithProviders(
      <ScanReceiveScreen {...makeProps("scan")} />,
    );
    mockTrack.mockClear();
    fireEvent.press(getByText("Receive"));
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvent.VIEW_ACCOUNT_QR_CODE);
  });

  it("closes via goBack when the close button is pressed", () => {
    const { getByTestId } = renderWithProviders(
      <ScanReceiveScreen {...makeProps()} />,
    );
    fireEvent.press(getByTestId("scan-receive-close-button"));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
