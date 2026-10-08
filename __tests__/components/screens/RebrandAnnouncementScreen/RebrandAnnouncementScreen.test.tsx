import { fireEvent } from "@testing-library/react-native";
import { RebrandAnnouncementScreen } from "components/screens/RebrandAnnouncementScreen";
import { AnalyticsEvent } from "config/analyticsConfig";
import { markRebrandAnnouncementSeen } from "helpers/rebrandAnnouncement";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { BackHandler } from "react-native";
import { analytics } from "services/analytics";

jest.mock("helpers/rebrandAnnouncement", () => ({
  markRebrandAnnouncementSeen: jest.fn(() => Promise.resolve()),
}));

jest.mock("services/analytics", () => ({
  analytics: {
    track: jest.fn(),
  },
}));

const mockTrack = analytics.track as jest.Mock;
const mockMarkSeen = markRebrandAnnouncementSeen as jest.Mock;

describe("RebrandAnnouncementScreen", () => {
  const onDismiss = jest.fn();

  const renderScreen = () =>
    renderWithProviders(<RebrandAnnouncementScreen onDismiss={onDismiss} />);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the announcement copy and actions", () => {
    const { getByText, getByTestId } = renderScreen();

    expect(getByText("Freighter is now Varial")).toBeTruthy();
    expect(
      getByText("Your Freighter wallet, now with a new name and look."),
    ).toBeTruthy();
    expect(getByText("Continue to Varial")).toBeTruthy();
    expect(getByTestId("rebrand-announcement-close-button")).toBeTruthy();
    expect(getByTestId("rebrand-announcement-illustration")).toBeTruthy();
  });

  it("marks the announcement seen and tracks the view as soon as it mounts", () => {
    renderScreen();

    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.REBRAND_ANNOUNCEMENT_VIEWED,
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses via the continue button", () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId("rebrand-announcement-continue-button"));

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.REBRAND_ANNOUNCEMENT_DISMISSED,
      { source: "continue" },
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses via the close button", () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId("rebrand-announcement-close-button"));

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.REBRAND_ANNOUNCEMENT_DISMISSED,
      { source: "close" },
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("treats the Android back button as a dismiss instead of letting it through", () => {
    let onBack: (() => boolean) | undefined;
    const remove = jest.fn();
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        onBack = handler as () => boolean;

        return { remove };
      });

    const { unmount } = renderScreen();

    expect(onBack).toBeDefined();
    // `true` tells React Native the press was handled, so the navigator
    // underneath never sees it.
    expect(onBack?.()).toBe(true);
    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.REBRAND_ANNOUNCEMENT_DISMISSED,
      { source: "back" },
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);

    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("registers the back listener once, even as the dismiss callback changes", () => {
    const remove = jest.fn();
    const addListener = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation(() => ({ remove }));

    const { rerender } = renderWithProviders(
      <RebrandAnnouncementScreen onDismiss={onDismiss} />,
    );
    const laterOnDismiss = jest.fn();
    rerender(<RebrandAnnouncementScreen onDismiss={laterOnDismiss} />);

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();

    // The single listener still reaches the latest callback.
    const onBack = addListener.mock.calls[0][1] as () => boolean;
    onBack();
    expect(laterOnDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("only dismisses once when both actions fire", () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId("rebrand-announcement-close-button"));
    fireEvent.press(getByTestId("rebrand-announcement-continue-button"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(
      mockTrack.mock.calls.filter(
        ([event]) => event === AnalyticsEvent.REBRAND_ANNOUNCEMENT_DISMISSED,
      ),
    ).toHaveLength(1);
  });
});
