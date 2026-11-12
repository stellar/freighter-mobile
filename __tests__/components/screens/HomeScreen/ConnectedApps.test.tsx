import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { act, fireEvent, render } from "@testing-library/react-native";
import ConnectedApps from "components/screens/HomeScreen/ConnectedApps";
import ConnectedAppsUnavailable from "components/screens/HomeScreen/ConnectedAppsUnavailable";
import React from "react";

const mockDisconnectAllSessions = jest.fn();
const mockShowToast = jest.fn();
/** Makes the sheet's dApp list throw while it renders. */
let mockFailList = false;
/** Makes building a dApp's row throw, outside the sheet. */
let mockFailRow = false;

jest.mock("ducks/walletKit", () => ({
  useWalletKitStore: () => ({
    activeSessions: {
      topic: {
        topic: "topic",
        peer: {
          metadata: {
            name: "dApp",
            url: "https://dapp.example",
            description: "",
            icons: [],
          },
        },
      },
    },
    disconnectSession: jest.fn(),
    disconnectAllSessions: mockDisconnectAllSessions,
  }),
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
jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: { publicKey: "GACCOUNT" } }),
}));
jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));
// Renders a sheet's header, content and footer as if it were open.
jest.mock("components/BottomSheet", () => ({
  __esModule: true,
  default: ({
    customContent,
    scrollViewHeaderComponent,
    scrollViewFooterComponent,
  }: {
    customContent: React.ReactNode;
    scrollViewHeaderComponent?: () => React.ReactNode;
    scrollViewFooterComponent?: () => React.ReactNode;
  }) => (
    <>
      {scrollViewHeaderComponent?.()}
      {customContent}
      {scrollViewFooterComponent?.()}
    </>
  ),
}));
jest.mock("components/screens/HomeScreen/ConnectedAppsBottomSheet", () => ({
  __esModule: true,
  default: () => {
    if (mockFailList) {
      throw new Error("dApp list render failed");
    }
    return null;
  },
}));
jest.mock("helpers/dappMetadata", () => ({
  toConnectedDapp: (session: { topic: string }) => {
    if (mockFailRow) {
      throw new Error("dApp row failed");
    }
    return { topic: session.topic, name: "dApp" };
  },
}));

const sheetRef = (dismiss = jest.fn()) =>
  ({ current: { dismiss } }) as unknown as React.RefObject<BottomSheetModal>;

describe("Connected Apps when a dApp can't be shown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // React reports the caught render error; the boundary handles it.
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockDisconnectAllSessions.mockResolvedValue(undefined);
    mockFailList = false;
    mockFailRow = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("says the list can't load and keeps Disconnect all when the list fails to render", async () => {
    mockFailList = true;
    const { getByText } = render(<ConnectedApps bottomSheetRef={sheetRef()} />);

    expect(getByText("connectedApps.loadFailed")).toBeTruthy();

    fireEvent.press(getByText("connectedApps.disconnectAllSessions"));
    await act(async () => {});

    expect(mockDisconnectAllSessions).toHaveBeenCalledWith(
      "GACCOUNT",
      "TESTNET",
    );
  });

  it("keeps Home up with a sheet that still disconnects all when Connected Apps fails to render", async () => {
    mockFailRow = true;
    const dismiss = jest.fn();
    const { getByText } = render(
      <ConnectedApps bottomSheetRef={sheetRef(dismiss)} />,
    );

    expect(getByText("connectedApps.loadFailed")).toBeTruthy();

    fireEvent.press(getByText("connectedApps.disconnectAllSessions"));
    await act(async () => {});

    expect(mockDisconnectAllSessions).toHaveBeenCalledWith(
      "GACCOUNT",
      "TESTNET",
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "connectedApps.allAppsDisconnected" }),
    );
    expect(dismiss).toHaveBeenCalled();
  });

  it("stand-in sheet: says the list can't load and disconnects all dApps", async () => {
    const dismiss = jest.fn();
    const { getByText } = render(
      <ConnectedAppsUnavailable bottomSheetRef={sheetRef(dismiss)} />,
    );

    expect(getByText("connectedApps.loadFailed")).toBeTruthy();

    fireEvent.press(getByText("connectedApps.disconnectAllSessions"));
    await act(async () => {});

    expect(mockDisconnectAllSessions).toHaveBeenCalledWith(
      "GACCOUNT",
      "TESTNET",
    );
    expect(dismiss).toHaveBeenCalled();
  });
});
