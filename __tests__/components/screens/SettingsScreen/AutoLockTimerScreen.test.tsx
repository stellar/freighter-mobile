import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { userEvent } from "@testing-library/react-native";
import AutoLockTimerScreen from "components/screens/SettingsScreen/SecurityScreen/AutoLockTimerScreen";
import { AUTO_LOCK_TIMER, DEFAULT_AUTO_LOCK_TIMER } from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { usePreferencesStore } from "ducks/preferences";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("services/autoLock", () => ({
  persistAutoLockTimer: jest.fn().mockResolvedValue(undefined),
  applyAutoLockTimerToHashKey: jest.fn().mockResolvedValue(undefined),
}));

type AutoLockTimerScreenNavigationProp = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.AUTO_LOCK_TIMER_SCREEN
>["navigation"];

type AutoLockTimerScreenRouteProp = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.AUTO_LOCK_TIMER_SCREEN
>["route"];

const mockNavigation = {
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as AutoLockTimerScreenNavigationProp;

const mockRoute = {
  key: "auto-lock-timer",
  name: SETTINGS_ROUTES.AUTO_LOCK_TIMER_SCREEN,
} as unknown as AutoLockTimerScreenRouteProp;

describe("AutoLockTimerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferencesStore.setState({ autoLockTimer: DEFAULT_AUTO_LOCK_TIMER });
  });

  const renderAutoLockTimerScreen = () =>
    renderWithProviders(
      <AutoLockTimerScreen navigation={mockNavigation} route={mockRoute} />,
    );

  it("renders all timer options", () => {
    const { getByTestId } = renderAutoLockTimerScreen();

    expect(
      getByTestId(`auto-lock-option-${AUTO_LOCK_TIMER.IMMEDIATELY}`),
    ).toBeTruthy();
    expect(
      getByTestId(`auto-lock-option-${AUTO_LOCK_TIMER.ONE_MINUTE}`),
    ).toBeTruthy();
    expect(
      getByTestId(`auto-lock-option-${AUTO_LOCK_TIMER.FIFTEEN_MINUTES}`),
    ).toBeTruthy();
    expect(
      getByTestId(`auto-lock-option-${AUTO_LOCK_TIMER.THIRTY_MINUTES}`),
    ).toBeTruthy();
    expect(
      getByTestId(`auto-lock-option-${AUTO_LOCK_TIMER.ONE_HOUR}`),
    ).toBeTruthy();
    expect(
      getByTestId(`auto-lock-option-${AUTO_LOCK_TIMER.TWELVE_HOURS}`),
    ).toBeTruthy();
    expect(
      getByTestId(`auto-lock-option-${AUTO_LOCK_TIMER.TWENTY_FOUR_HOURS}`),
    ).toBeTruthy();
    expect(
      getByTestId(`auto-lock-option-${AUTO_LOCK_TIMER.NONE}`),
    ).toBeTruthy();
  });

  it("renders the footer explanation", () => {
    const { getByText } = renderAutoLockTimerScreen();

    expect(
      getByText(
        "After a set time, you will be prompted for your password again as an extra security measure.",
      ),
    ).toBeTruthy();
  });

  it("updates the preference when an option is tapped", async () => {
    const { getByTestId } = renderAutoLockTimerScreen();

    await userEvent.press(
      getByTestId(`auto-lock-option-${AUTO_LOCK_TIMER.FIFTEEN_MINUTES}`),
    );

    expect(usePreferencesStore.getState().autoLockTimer).toBe(
      AUTO_LOCK_TIMER.FIFTEEN_MINUTES,
    );
  });
});
