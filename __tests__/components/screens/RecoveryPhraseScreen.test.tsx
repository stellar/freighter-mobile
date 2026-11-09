import { act, fireEvent } from "@testing-library/react-native";
import {
  COPIED_FADED_OPACITY,
  COPIED_FADE_IN_MS,
  COPIED_FADE_OUT_MS,
  COPIED_FEEDBACK_DURATION_MS,
  REVEAL_FADE_MS,
  REVEAL_SETTLE_MS,
  REVEAL_SLIDE_MS,
  REVEAL_TRANSITION_MS,
  RecoveryPhraseScreen,
} from "components/screens/RecoveryPhraseScreen";
import { AnalyticsEvent } from "config/analyticsConfig";
import { getThemeColors } from "config/colors";
import { BiometricsSource } from "config/constants";
import { useLoginDataStore } from "ducks/loginData";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Animated, NativeModules, StyleSheet } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";
import { analytics } from "services/analytics";

/** How long Jest's native animation mock runs any animation. */
const MOCK_NATIVE_ANIMATION_MS = 16;

const PHRASE =
  "gloom student label strategy tattoo promote brand mushroom problem divert carbon erode";
const WORDS = PHRASE.split(" ");

jest.mock("@react-native-community/blur", () => ({ BlurView: "BlurView" }));

const mockGenerateMnemonic = jest.fn<string, [unknown?]>(() => PHRASE);
jest.mock("stellar-hd-wallet", () => ({
  generateMnemonic: (options?: unknown) => mockGenerateMnemonic(options),
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useSecureClipboard", () => ({
  useSecureClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

const mockFinishWalletSetup = jest.fn();
jest.mock("hooks/useFinishWalletSetup", () => ({
  useFinishWalletSetup: () => mockFinishWalletSetup,
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: (
    selector: (state: { isLoading: boolean }) => unknown,
  ) => selector({ isLoading: false }),
}));

let mockIsReducedMotion = false;
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  ...jest.requireActual<object>("react-native-reanimated"),
  useReducedMotion: () => mockIsReducedMotion,
}));

const renderScreen = () =>
  renderWithProviders(
    <RecoveryPhraseScreen navigation={{} as never} route={{} as never} />,
  );

/** Reveals the phrase and lets the transition finish. */
const renderRevealed = () => {
  const screen = renderScreen();
  fireEvent.press(screen.getByTestId("reveal-recovery-phrase-button"));
  act(() => {
    jest.advanceTimersByTime(REVEAL_TRANSITION_MS);
  });
  return screen;
};

describe("RecoveryPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsReducedMotion = false;
    useLoginDataStore.setState({ password: "password1", mnemonicPhrase: null });
  });
  afterEach(() => jest.useRealTimers());

  it("keeps the phrase off the screen until the user reveals it", () => {
    const { getByText, queryByText } = renderScreen();

    expect(getByText("Recovery Phrase")).toBeTruthy();
    expect(getByText("I understand. Reveal my phrase")).toBeTruthy();
    WORDS.forEach((word) => expect(queryByText(word)).toBeNull());
  });

  it("reveals the phrase and counts the view", () => {
    const { getByText } = renderRevealed();

    expect(getByText("You saved it, right?")).toBeTruthy();
    WORDS.forEach((word) => expect(getByText(word)).toBeTruthy());
    expect(analytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.VIEWED_RECOVERY_PHRASE,
    );
  });

  it("generates one phrase and keeps it in memory for the flow", () => {
    renderScreen();

    expect(mockGenerateMnemonic).toHaveBeenCalledTimes(1);
    expect(useLoginDataStore.getState().mnemonicPhrase).toBe(PHRASE);
  });

  it("shows the same phrase when the user comes back to it", () => {
    const stored =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";
    useLoginDataStore.setState({ mnemonicPhrase: stored });

    const { getByText } = renderRevealed();

    expect(getByText("accident")).toBeTruthy();
    expect(mockGenerateMnemonic).not.toHaveBeenCalled();
  });

  it("warns in amber that the wallet can't be recovered without it", () => {
    const { getByText } = renderRevealed();
    const warning = getByText(
      "Make sure you've saved it.\nYou can't recover your wallet without it.",
    );

    expect(StyleSheet.flatten(warning.props.style).color).toBe(
      getThemeColors("light").amber[11],
    );
  });

  it("finishes creating the wallet from Next", () => {
    const { getByTestId } = renderRevealed();

    fireEvent.press(getByTestId("default-action-button"));

    expect(mockFinishWalletSetup).toHaveBeenCalledWith(
      BiometricsSource.ONBOARDING,
    );
  });

  // Revealing, the button slides down to where Next sits, and then the rest
  // fades: title, phrase, Tap to copy, warning and the button's label.
  describe("the reveal transition", () => {
    it("ignores taps until the screen settles", () => {
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("reveal-recovery-phrase-button"));
      fireEvent.press(getByTestId("copy-recovery-phrase-button"));
      fireEvent.press(getByTestId("default-action-button"));
      expect(mockCopyToClipboard).not.toHaveBeenCalled();
      expect(mockFinishWalletSetup).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(REVEAL_TRANSITION_MS);
      });
      fireEvent.press(getByTestId("copy-recovery-phrase-button"));
      fireEvent.press(getByTestId("default-action-button"));

      expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
      expect(mockFinishWalletSetup).toHaveBeenCalledTimes(1);
    });

    it("changes the button's label mid-slide, before the rest fades in", () => {
      const { getByTestId } = renderScreen();
      const opacityOf = (testID: string) =>
        getAnimatedStyle(getByTestId(testID)).opacity;

      fireEvent.press(getByTestId("reveal-recovery-phrase-button"));
      act(() => {
        jest.advanceTimersByTime(REVEAL_SLIDE_MS);
      });

      expect(opacityOf("recovery-phrase-next-layer")).toBe(1);
      expect(opacityOf("recovery-phrase-words-layer")).toBe(0);
    });

    it("keeps the hidden state under the new one until the fade is over", () => {
      const { getByTestId, getByText, queryByTestId, queryByText } =
        renderScreen();

      fireEvent.press(getByTestId("reveal-recovery-phrase-button"));

      expect(getByText("Recovery Phrase")).toBeTruthy();
      expect(getByTestId("recovery-phrase-container-frost")).toBeTruthy();
      expect(getByTestId("reveal-recovery-phrase-button")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(REVEAL_TRANSITION_MS);
      });

      expect(queryByText("Recovery Phrase")).toBeNull();
      expect(queryByTestId("recovery-phrase-container-frost")).toBeNull();
      expect(queryByTestId("reveal-recovery-phrase-button")).toBeNull();
      expect(getByText("You saved it, right?")).toBeTruthy();
    });

    it("skips the slide under Reduce Motion, so the screen settles once the fade is over", () => {
      mockIsReducedMotion = true;
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("reveal-recovery-phrase-button"));
      fireEvent.press(getByTestId("default-action-button"));
      expect(mockFinishWalletSetup).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(REVEAL_FADE_MS + REVEAL_SETTLE_MS);
      });
      fireEvent.press(getByTestId("default-action-button"));

      expect(mockFinishWalletSetup).toHaveBeenCalledTimes(1);
    });
  });

  describe("copying", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it("copies through the secure clipboard and confirms in place", () => {
      const { getByTestId, getByText, queryByText } = renderRevealed();

      fireEvent.press(getByTestId("copy-recovery-phrase-button"));

      expect(mockCopyToClipboard).toHaveBeenCalledWith(PHRASE, {
        hideNotification: true,
      });
      expect(analytics.trackCopyBackupPhrase).toHaveBeenCalledTimes(1);
      expect(getByText("Copied")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(
          COPIED_FEEDBACK_DURATION_MS + COPIED_FADE_OUT_MS + COPIED_FADE_IN_MS,
        );
      });

      expect(queryByText("Copied")).toBeNull();
      expect(getByText("Tap to copy")).toBeTruthy();
    });

    // TouchableOpacity's press dims the button and fades it back in with
    // "Copied"; the return to "Tap to copy" mirrors it.
    it("fades from Copied back to Tap to copy", () => {
      const timing = jest.spyOn(Animated, "timing").mockImplementation(
        () =>
          ({
            start: (callback?: Animated.EndCallback) =>
              callback?.({ finished: true }),
            stop: jest.fn(),
          }) as unknown as Animated.CompositeAnimation,
      );
      const { getByTestId, getByText } = renderRevealed();
      fireEvent.press(getByTestId("copy-recovery-phrase-button"));
      timing.mockClear();

      act(() => {
        jest.advanceTimersByTime(COPIED_FEEDBACK_DURATION_MS);
      });

      const fades = timing.mock.calls.map(([, config]) => config);
      expect(fades).toContainEqual(
        expect.objectContaining({
          toValue: COPIED_FADED_OPACITY,
          duration: COPIED_FADE_OUT_MS,
        }),
      );
      expect(fades).toContainEqual(
        expect.objectContaining({ toValue: 1, duration: COPIED_FADE_IN_MS }),
      );
      expect(getByText("Tap to copy")).toBeTruthy();
    });

    // Jest's native animation mock ends each animation a frame after it
    // starts, whatever its duration, so a fade cut short shows only as a stop
    // sent to the native side. Going a frame at a time lets the screen
    // update while the fade back in still runs, as it does on a device.
    it("lets Tap to copy fade all the way back in", () => {
      const { startAnimatingNode, stopAnimation } =
        NativeModules.NativeAnimatedModule as {
          startAnimatingNode: jest.Mock<
            void,
            [id: number, node: number, config: { toValue?: number }]
          >;
          stopAnimation: jest.Mock<void, [id: number]>;
        };
      const { getByTestId } = renderRevealed();
      fireEvent.press(getByTestId("copy-recovery-phrase-button"));
      startAnimatingNode.mockClear();

      act(() => {
        jest.advanceTimersByTime(COPIED_FEEDBACK_DURATION_MS);
      });
      act(() => {
        jest.advanceTimersByTime(MOCK_NATIVE_ANIMATION_MS);
      });
      act(() => {
        jest.advanceTimersByTime(COPIED_FADE_IN_MS);
      });

      const starts = startAnimatingNode.mock.calls;
      const fadeOut = starts.find(
        ([, , config]) => config.toValue === COPIED_FADED_OPACITY,
      );
      const fadeBackIn = starts.find(
        ([, node, config]) => node === fadeOut?.[1] && config.toValue === 1,
      );
      expect(fadeBackIn).toBeDefined();
      expect(stopAnimation).not.toHaveBeenCalledWith(fadeBackIn?.[0]);
    });

    it("ignores taps, without a highlight, while Copied shows", () => {
      const { getByTestId } = renderRevealed();

      fireEvent.press(getByTestId("copy-recovery-phrase-button"));
      fireEvent.press(getByTestId("copy-recovery-phrase-button"));

      expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
      expect(
        getByTestId("copy-recovery-phrase-button").props.accessibilityState,
      ).toMatchObject({ disabled: true });
    });

    it("leaves no timer behind when the screen goes away mid-feedback", () => {
      // The press animations keep timers of their own, so this follows the
      // feedback timer itself rather than counting every timer.
      const setTimeoutSpy = jest.spyOn(global, "setTimeout");
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
      const { getByTestId, unmount } = renderRevealed();

      fireEvent.press(getByTestId("copy-recovery-phrase-button"));
      const feedbackCall = setTimeoutSpy.mock.calls.findIndex(
        ([, delay]) => delay === COPIED_FEEDBACK_DURATION_MS,
      );
      const feedbackTimer = setTimeoutSpy.mock.results[feedbackCall]?.value;
      unmount();

      expect(feedbackTimer).toBeDefined();
      expect(clearTimeoutSpy).toHaveBeenCalledWith(feedbackTimer);
    });
  });
});
