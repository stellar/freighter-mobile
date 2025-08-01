import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { screen, userEvent } from "@testing-library/react-native";
import ShareFeedbackScreen from "components/screens/SettingsScreen/ShareFeedbackScreen/ShareFeedbackScreen";
import {
  FREIGHTER_DISCORD_URL,
  FREIGHTER_GITHUB_ISSUE_URL,
} from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "shareFeedbackScreen.discord": "Discord",
      "shareFeedbackScreen.github": "GitHub",
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

type ShareFeedbackScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SHARE_FEEDBACK_SCREEN
>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as ShareFeedbackScreenProps["navigation"];

const mockRoute = {
  key: "ShareFeedbackScreen",
  name: SETTINGS_ROUTES.SHARE_FEEDBACK_SCREEN,
} as unknown as ShareFeedbackScreenProps["route"];

describe("ShareFeedbackScreen", () => {
  beforeEach(() => {
    mockOpenURL.mockClear();
  });

  it("renders correctly with Discord and GitHub options", () => {
    renderWithProviders(
      <ShareFeedbackScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(screen.getByText("Discord")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
  });

  it("calls Linking.openURL with Discord URL when Discord option is pressed", async () => {
    renderWithProviders(
      <ShareFeedbackScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const discordOption = screen.getByText("Discord");
    await userEvent.press(discordOption);

    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith(FREIGHTER_DISCORD_URL);
  }, 10000);

  it("calls Linking.openURL with GitHub URL when GitHub option is pressed", async () => {
    renderWithProviders(
      <ShareFeedbackScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const githubOption = screen.getByText("GitHub");
    await userEvent.press(githubOption);

    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith(FREIGHTER_GITHUB_ISSUE_URL);
  }, 10000);
});
