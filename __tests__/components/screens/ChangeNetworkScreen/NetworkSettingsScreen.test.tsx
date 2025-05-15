import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { screen } from "@testing-library/react-native";
import NetworkSettingsScreen from "components/screens/ChangeNetworkScreen/NetworkSettingsScreen";
import {
  FRIENDBOT_URLS,
  NETWORK_NAMES,
  NETWORK_URLS,
  NETWORKS,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

type NetworkSettingsScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.NETWORK_SETTINGS_SCREEN
>;

const mockNavigate = jest.fn();
const mockRoute = (network: NETWORKS) => ({
  key: "NetworkSettingsScreen",
  name: SETTINGS_ROUTES.NETWORK_SETTINGS_SCREEN,
  params: {
    selectedNetwork: network,
  },
});

const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as NetworkSettingsScreenProps["navigation"];

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "networkSettingsScreen.networkName": "Network Name",
      "networkSettingsScreen.horizonUrl": "Horizon URL",
      "networkSettingsScreen.passphrase": "Passphrase",
      "networkSettingsScreen.friendbotUrl": "Friendbot URL",
      "networkSettingsScreen.friendbotPlaceholder": "Enter Friendbot URL",
    };
    return translations[key] || key;
  },
}));

describe("NetworkSettingsScreen", () => {
  it("renders correctly with Testnet details", () => {
    renderWithProviders(
      <NetworkSettingsScreen
        route={
          mockRoute(NETWORKS.TESTNET) as NetworkSettingsScreenProps["route"]
        }
        navigation={mockNavigation}
      />,
    );

    expect(screen.getByText(NETWORK_NAMES[NETWORKS.TESTNET])).toBeTruthy();
    expect(
      screen.getByPlaceholderText(NETWORK_NAMES[NETWORKS.TESTNET]),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(NETWORK_URLS[NETWORKS.TESTNET]),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        mapNetworkToNetworkDetails(NETWORKS.TESTNET).networkPassphrase,
      ),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(FRIENDBOT_URLS[NETWORKS.TESTNET]),
    ).toBeTruthy();
  });

  it("renders correctly with Public network details and friendbot placeholder", () => {
    renderWithProviders(
      <NetworkSettingsScreen
        route={
          mockRoute(NETWORKS.PUBLIC) as NetworkSettingsScreenProps["route"]
        }
        navigation={mockNavigation}
      />,
    );

    expect(screen.getByText(NETWORK_NAMES[NETWORKS.PUBLIC])).toBeTruthy();
    expect(
      screen.getByPlaceholderText(NETWORK_NAMES[NETWORKS.PUBLIC]),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(NETWORK_URLS[NETWORKS.PUBLIC]),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        mapNetworkToNetworkDetails(NETWORKS.PUBLIC).networkPassphrase,
      ),
    ).toBeTruthy();

    expect(screen.getByPlaceholderText("Enter Friendbot URL")).toBeTruthy();
  });
});
