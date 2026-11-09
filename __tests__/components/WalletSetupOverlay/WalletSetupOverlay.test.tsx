import { act, render as renderTree } from "@testing-library/react-native";
import {
  WALLET_SETUP_OVERLAY_TEST_ID as OVERLAY,
  WalletSetupOverlay,
} from "components/WalletSetupOverlay";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useWalletSetupOverlayStore } from "ducks/walletSetupOverlay";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { AccessibilityInfo, BackHandler } from "react-native";
import {
  ReduceMotion,
  ReducedMotionConfig,
  getAnimatedStyle,
} from "react-native-reanimated";

// The screen reads Reduce Motion from Reanimated, which knows it from launch.
// The app's own hook answers asynchronously, and setup blocks the JS thread
// that would receive the answer.
const mockReduceMotion = jest.fn(() => false);
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  ...jest.requireActual<object>("react-native-reanimated"),
  useReducedMotion: () => mockReduceMotion(),
}));

const PUBLIC_KEY = "GBNEWWALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const store = () => useWalletSetupOverlayStore.getState();
const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });
const run = (action: () => void) => act(action);

type Element = Parameters<typeof getAnimatedStyle>[0];
const styleOf = (element: Element) =>
  getAnimatedStyle(element) as unknown as {
    opacity?: number;
    transform?: readonly Record<string, number>[];
  };
const transformOf = (element: Element) =>
  Object.assign({}, ...(styleOf(element).transform ?? [])) as Record<
    string,
    number
  >;

const render = () => renderWithProviders(<WalletSetupOverlay />);

describe("WalletSetupOverlay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReduceMotion.mockReturnValue(false);
    useWalletSetupOverlayStore.setState(
      useWalletSetupOverlayStore.getInitialState(),
      true,
    );
    useAuthenticationStore.setState({
      account: { publicKey: PUBLIC_KEY } as never,
    });
    useBalancesStore.setState({
      fetchedPublicKey: null,
      isLoading: true,
      error: null,
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders nothing while hidden", () => {
    const { queryByTestId } = render();

    expect(queryByTestId(OVERLAY)).toBeNull();
  });

  it("says Creating your wallet... while a new wallet is set up", () => {
    const { getByText } = render();
    run(() => store().begin("create"));

    expect(getByText("Creating your wallet...")).toBeTruthy();
  });

  it("says Importing your wallet... while a wallet is imported", () => {
    const { getByText } = render();
    run(() => store().begin("import"));

    expect(getByText("Importing your wallet...")).toBeTruthy();
  });

  it("fades in over 200ms", () => {
    const { getByTestId } = render();
    run(() => store().begin("create"));
    expect(styleOf(getByTestId(OVERLAY)).opacity).toBe(0);

    advance(200);

    expect(styleOf(getByTestId(OVERLAY)).opacity).toBe(1);
  });

  it("turns to Your wallet is ready! when setup succeeds", () => {
    const { getByTestId, getByText } = render();
    run(() => store().begin("create"));
    advance(200);

    run(() => store().succeed());
    advance(200);

    // The loading title is hidden from screen readers now, which the default
    // queries skip, so it's queried with hidden elements included.
    const loadingTitle = getByTestId(`${OVERLAY}-title-loading`, {
      includeHiddenElements: true,
    });
    const readyTitle = getByTestId(`${OVERLAY}-title-ready`);

    expect(getByText("Your wallet is ready!")).toBeTruthy();
    expect(styleOf(readyTitle).opacity).toBe(1);
    expect(styleOf(loadingTitle).opacity).toBe(0);
    expect(loadingTitle.props.accessibilityElementsHidden).toBe(true);
    expect(readyTitle.props.accessibilityElementsHidden).toBe(false);
  });

  it("announces each title to screen readers", () => {
    const announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => {});
    render();

    run(() => store().begin("import"));
    expect(announce).toHaveBeenLastCalledWith("Importing your wallet...");

    run(() => store().succeed());
    expect(announce).toHaveBeenLastCalledWith("Your wallet is ready!");
  });

  // Figma's wave grows the circle to 1.4× as it fades, and repeats every
  // 1.5s. The screen can leave 1s after setup succeeds, and the first wave
  // plays under the title's change, so a second follows right after it.
  it("sends the circle out in two waves once setup succeeds", () => {
    const { getByTestId } = render();
    const circle = () => getByTestId(`${OVERLAY}-circle`);
    run(() => store().begin("create"));
    advance(200);
    expect(styleOf(circle()).opacity).toBe(1);

    run(() => store().succeed());
    advance(275);
    expect(styleOf(circle()).opacity).toBeLessThan(0.5);
    expect(transformOf(circle()).scale).toBeGreaterThan(1.2);

    // 25ms into the second wave, the circle is back, nearly whole.
    advance(300);
    expect(styleOf(circle()).opacity).toBeGreaterThan(0.5);
    expect(transformOf(circle()).scale).toBeLessThan(1.2);

    advance(550);
    expect(styleOf(circle()).opacity).toBe(0);
    expect(transformOf(circle()).scale).toBeCloseTo(1.4, 6);

    // And no third.
    advance(1000);
    expect(styleOf(circle()).opacity).toBe(0);
  });

  // Setup blocks the JS thread right after the screen appears, so the loop
  // has to start from the first frame, not after an asynchronous answer.
  it("hops from its first frame, before any asynchronous answer arrives", () => {
    const { getByTestId } = render();
    run(() => store().begin("create"));

    expect(
      transformOf(getByTestId(`${OVERLAY}-sparkle`)).translateX,
    ).toBeLessThan(0);
  });

  describe("with Reduce Motion", () => {
    beforeEach(() => {
      // As the OS turns it on: Reanimated reads it at launch, both for
      // useReducedMotion and for every animation that follows the system
      // setting, which withTiming does unless told otherwise.
      mockReduceMotion.mockReturnValue(true);
      // ReducedMotionConfig turns it on for the animations, and warns that
      // it did. Unmounting it after the test turns it back off.
      jest.spyOn(console, "warn").mockImplementation(() => {});
      renderTree(<ReducedMotionConfig mode={ReduceMotion.Always} />);
    });

    it("keeps the sparkle and the circle still", () => {
      const { getByTestId } = render();
      run(() => store().begin("create"));

      // 12% into the loop, the sparkle would be 5pt up.
      advance(180);
      expect(
        transformOf(getByTestId(`${OVERLAY}-sparkle`)).translateY,
      ).toBeCloseTo(0, 6);

      run(() => store().succeed());
      advance(600);
      expect(styleOf(getByTestId(`${OVERLAY}-circle`)).opacity).toBe(1);
    });

    // Only the bounce and the circle go. The fades aren't motion, and
    // without them the screen would flash in and out.
    it("still fades in", () => {
      const { getByTestId } = render();
      run(() => store().begin("create"));

      advance(100);

      const { opacity } = styleOf(getByTestId(OVERLAY));
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
    });

    it("still cross-fades the title", () => {
      const { getByTestId } = render();
      run(() => store().begin("create"));
      advance(200);

      run(() => store().succeed());
      advance(100);

      const { opacity } = styleOf(getByTestId(`${OVERLAY}-title-ready`));
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
    });

    it("still fades out", () => {
      const { getByTestId } = render();
      run(() => store().begin("create"));
      advance(200);
      run(() => store().fail());

      advance(150);

      const { opacity } = styleOf(getByTestId(OVERLAY));
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
    });
  });

  it("fades out and goes away after a failure", () => {
    const { getByTestId, queryByTestId } = render();
    run(() => store().begin("create"));
    advance(200);

    run(() => store().fail());
    advance(299);
    expect(getByTestId(OVERLAY)).toBeTruthy();
    expect(store().phase).toBe("leaving");

    advance(1);
    expect(store().phase).toBe("hidden");
    expect(queryByTestId(OVERLAY)).toBeNull();
  });

  // Setup can fail the moment it starts. The screen still leaves.
  it("goes away when setup fails in the same moment it began", () => {
    const { queryByTestId } = render();
    run(() => {
      store().begin("create");
      store().fail();
    });

    advance(300);

    expect(store().phase).toBe("hidden");
    expect(queryByTestId(OVERLAY)).toBeNull();
  });

  it("keeps a retry that begins while the failure fades out", () => {
    const { getByTestId } = render();
    run(() => store().begin("create"));
    advance(200);
    run(() => store().fail());
    advance(100);

    run(() => store().begin("import"));
    advance(500);

    expect(store().phase).toBe("settingUp");
    expect(styleOf(getByTestId(OVERLAY)).opacity).toBe(1);
  });

  it("leaves after the ready wait, once the balances are in", () => {
    const { queryByTestId } = render();
    run(() => store().begin("create"));
    run(() => store().succeed());
    run(() =>
      useBalancesStore.setState({
        fetchedPublicKey: PUBLIC_KEY,
        isLoading: false,
      }),
    );

    advance(1000);
    expect(store().phase).toBe("leaving");

    advance(300);
    expect(store().phase).toBe("hidden");
    expect(queryByTestId(OVERLAY)).toBeNull();
  });

  it("swallows Android back while it's up", () => {
    let onBack: (() => boolean) | undefined;
    const addEventListener = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        onBack = handler as () => boolean;
        return { remove: jest.fn() };
      });
    render();
    expect(addEventListener).not.toHaveBeenCalled();

    run(() => store().begin("create"));

    expect(onBack?.()).toBe(true);
  });
});
