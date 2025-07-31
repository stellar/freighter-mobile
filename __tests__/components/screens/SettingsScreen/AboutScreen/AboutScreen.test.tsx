import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent, screen } from "@testing-library/react-native";
import AboutScreen from "components/screens/SettingsScreen/AboutScreen/AboutScreen";
import {
  FREIGHTER_BASE_URL,
  STELLAR_FOUNDATION_BASE_URL,
  STELLAR_FOUNDATION_TERMS_URL,
  STELLAR_FOUNDATION_PRIVACY_URL,
} from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("react-native-device-info", () => ({
  getVersion: () => "1.2.3",
  getBuildNumber: () => "42",
}));

const mockCurrentYear = 2023;
jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "aboutScreen.freighterDescription": "Freighter is a Stellar wallet.",
      "aboutScreen.listTitle": "Important Links",
      "aboutScreen.links.freighter": "Freighter Website",
      "aboutScreen.links.stellar": "Stellar Foundation",
      "aboutScreen.links.privacyPolicy": "Privacy Policy",
      "aboutScreen.links.termsOfService": "Terms of Service",
      "aboutScreen.stellarFoundation": `© ${mockCurrentYear} Stellar Development Foundation`,
    };
    return translations[key] || key;
  },
}));

const mockOpenURL = jest.fn();
jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: mockOpenURL,
  canOpenURL: jest.fn().mockResolvedValue(true),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

type AboutScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.ABOUT_SCREEN
>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as AboutScreenProps["navigation"];

const mockRoute = {
  key: "AboutScreen",
  name: SETTINGS_ROUTES.ABOUT_SCREEN,
} as unknown as AboutScreenProps["route"];

describe("AboutScreen", () => {
  beforeEach(() => {
    mockOpenURL.mockClear();
  });

  it("renders correctly with all information", () => {
    renderWithProviders(
      <AboutScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(screen.getByText("Freighter is a Stellar wallet.")).toBeTruthy();
    expect(screen.getByText("v1.2.3 (42)")).toBeTruthy();

    expect(screen.getByText("Important Links")).toBeTruthy();
    expect(screen.getByText("Freighter Website")).toBeTruthy();
    expect(screen.getByText("Stellar Foundation")).toBeTruthy();
    expect(screen.getByText("Privacy Policy")).toBeTruthy();
    expect(screen.getByText("Terms of Service")).toBeTruthy();

    expect(
      screen.getByText(`© ${mockCurrentYear} Stellar Development Foundation`),
    ).toBeTruthy();
  });

  it("opens Freighter website link when pressed", () => {
    renderWithProviders(
      <AboutScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.press(screen.getByText("Freighter Website"));
    expect(mockOpenURL).toHaveBeenCalledWith(FREIGHTER_BASE_URL);
  });

  it("opens Stellar Foundation link when pressed", () => {
    renderWithProviders(
      <AboutScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.press(screen.getByText("Stellar Foundation"));
    expect(mockOpenURL).toHaveBeenCalledWith(STELLAR_FOUNDATION_BASE_URL);
  });

  it("opens Privacy Policy link when pressed", () => {
    renderWithProviders(
      <AboutScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.press(screen.getByText("Privacy Policy"));
    expect(mockOpenURL).toHaveBeenCalledWith(STELLAR_FOUNDATION_PRIVACY_URL);
  });

  it("opens Terms of Service link when pressed", () => {
    renderWithProviders(
      <AboutScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.press(screen.getByText("Terms of Service"));
    expect(mockOpenURL).toHaveBeenCalledWith(STELLAR_FOUNDATION_TERMS_URL);
  });
});
