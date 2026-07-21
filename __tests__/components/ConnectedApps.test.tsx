import { fireEvent, render } from "@testing-library/react-native";
import ConnectedApps from "components/screens/HomeScreen/ConnectedApps";
import React from "react";

const mockDisconnectAll = jest.fn();
const mockDisconnectSession = jest.fn();
const mockNavigate = jest.fn();
const mockDismiss = jest.fn();

jest.mock("hooks/useAppTranslation", () => () => ({ t: (k: string) => k }));
jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: { publicKey: "GABC" },
}));
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "TESTNET" }),
}));
jest.mock("ducks/protocols", () => ({
  useProtocolsStore: () => ({ protocols: [] }),
}));
jest.mock("ducks/remoteConfig", () => ({
  useRemoteConfigStore: () => ({ discover_enabled: true }),
}));
jest.mock("helpers/protocols", () => ({
  findMatchedProtocol: () => undefined,
}));
jest.mock("ducks/walletKit", () => ({
  useWalletKitStore: () => ({
    activeSessions: {
      "topic-1": {
        topic: "topic-1",
        peer: {
          metadata: { name: "StellarX", url: "https://x", icons: ["i"] },
        },
      },
    },
    disconnectSession: mockDisconnectSession,
    disconnectAllSessions: mockDisconnectAll,
  }),
}));
// Isolate the wrapper: render only the footer, not the list content.
jest.mock("components/screens/HomeScreen/ConnectedAppsBottomSheet", () => ({
  __esModule: true,
  default: () => null,
}));
// Render customContent + footer synchronously so we can drive the footer button.
jest.mock("components/BottomSheet", () => ({
  __esModule: true,
  default: ({
    customContent,
    scrollViewFooterComponent,
  }: {
    customContent: React.ReactNode;
    scrollViewFooterComponent?: () => React.ReactNode;
  }) => (
    <>
      {customContent}
      {scrollViewFooterComponent ? scrollViewFooterComponent() : null}
    </>
  ),
}));

describe("ConnectedApps", () => {
  beforeEach(() => jest.clearAllMocks());

  it("disconnects all sessions when the footer button is pressed", () => {
    const ref = {
      current: { present: jest.fn(), dismiss: mockDismiss },
    } as never;
    const { getByText } = render(
      <ConnectedApps
        navigation={{ navigate: mockNavigate } as never}
        bottomSheetRef={ref}
      />,
    );
    fireEvent.press(getByText("connectedApps.disconnectAllSessions"));
    expect(mockDisconnectAll).toHaveBeenCalledWith("GABC", "TESTNET");
  });
});
