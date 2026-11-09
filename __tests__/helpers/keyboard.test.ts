import { waitForKeyboardDismiss } from "helpers/keyboard";
import { Keyboard } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";

// Tests flip this to take the Android path.
let mockIsAndroid = false;
// Defined, not spread: spreading a getter copies its value once, while the
// mock is built, before this file has set it.
jest.mock("helpers/device", () =>
  Object.defineProperties(
    { ...jest.requireActual("helpers/device") },
    { isAndroid: { get: () => mockIsAndroid, enumerable: true } },
  ),
);

/** A promise the test settles. */
const deferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** Whether the promise has settled, after pending callbacks have run. */
const hasSettled = async (promise: Promise<void>) => {
  let settled = false;
  promise.then(() => {
    settled = true;
  });
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  return settled;
};

describe("waitForKeyboardDismiss", () => {
  afterEach(() => {
    mockIsAndroid = false;
    jest.restoreAllMocks();
  });

  // Android's own keyboardDidHide fires as the keyboard starts sliding
  // away. keyboard-controller's fires when the slide ends.
  it("waits for keyboard-controller's dismiss on Android", async () => {
    mockIsAndroid = true;
    const hidden = deferred();
    jest.spyOn(KeyboardController, "dismiss").mockReturnValue(hidden.promise);

    const wait = waitForKeyboardDismiss();
    expect(KeyboardController.dismiss).toHaveBeenCalled();
    expect(await hasSettled(wait)).toBe(false);

    hidden.resolve();
    expect(await hasSettled(wait)).toBe(true);
  });

  it("waits for React Native's keyboardDidHide on iOS", async () => {
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
    const dismiss = jest.spyOn(Keyboard, "dismiss");
    const addListener = jest.spyOn(Keyboard, "addListener");

    const wait = waitForKeyboardDismiss();
    expect(dismiss).toHaveBeenCalled();
    expect(await hasSettled(wait)).toBe(false);

    addListener.mock.calls
      .filter(([event]) => event === "keyboardDidHide")
      .forEach(([, listener]) => listener({} as never));
    expect(await hasSettled(wait)).toBe(true);
  });

  it("resolves at once on iOS when the keyboard is already down", async () => {
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(false);

    expect(await hasSettled(waitForKeyboardDismiss())).toBe(true);
  });

  describe("timeoutMs", () => {
    /**
     * Stands in for the keyboardDidHide emitter. Like the real one, it stops
     * calling a listener once its subscription is removed, so a test can fire
     * a late event and see whether the helper let go of its listener.
     */
    const watchKeyboardDidHide = () => {
      const subscription = { remove: jest.fn() };
      let listener: () => void = () => {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((
        event: string,
        callback: () => void,
      ) => {
        if (event === "keyboardDidHide") {
          listener = callback;
        }
        return subscription;
      }) as never);
      const fireHide = () => {
        if (subscription.remove.mock.calls.length === 0) {
          listener();
        }
      };
      return { subscription, fireHide };
    };

    beforeEach(() => {
      // setImmediate stays real: hasSettled uses it to flush callbacks.
      jest.useFakeTimers({ doNotFake: ["setImmediate"] });
      jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
      jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("resolves on keyboardDidHide and clears its timer", async () => {
      const { subscription, fireHide } = watchKeyboardDidHide();

      const wait = waitForKeyboardDismiss(500);
      expect(await hasSettled(wait)).toBe(false);

      fireHide();
      expect(await hasSettled(wait)).toBe(true);
      expect(subscription.remove).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("resolves after the timeout when no hide event comes", async () => {
      const { subscription } = watchKeyboardDidHide();

      const wait = waitForKeyboardDismiss(500);
      jest.advanceTimersByTime(499);
      expect(await hasSettled(wait)).toBe(false);

      jest.advanceTimersByTime(1);
      expect(await hasSettled(wait)).toBe(true);
      expect(subscription.remove).toHaveBeenCalledTimes(1);
    });

    it("runs nothing a second time when the hide event comes late", async () => {
      const { subscription, fireHide } = watchKeyboardDidHide();
      const onDismissed = jest.fn();

      waitForKeyboardDismiss(500).then(onDismissed);
      jest.advanceTimersByTime(500);
      await hasSettled(Promise.resolve());
      expect(onDismissed).toHaveBeenCalledTimes(1);
      // The timeout let go of the listener, so the late event reaches nothing.
      expect(subscription.remove).toHaveBeenCalledTimes(1);

      fireHide();
      jest.advanceTimersByTime(1000);
      await hasSettled(Promise.resolve());
      expect(onDismissed).toHaveBeenCalledTimes(1);
      expect(subscription.remove).toHaveBeenCalledTimes(1);
    });

    it("keeps waiting for the hide event without one", async () => {
      const { subscription, fireHide } = watchKeyboardDidHide();

      const wait = waitForKeyboardDismiss();
      jest.advanceTimersByTime(60_000);
      expect(await hasSettled(wait)).toBe(false);
      expect(subscription.remove).not.toHaveBeenCalled();

      fireHide();
      expect(await hasSettled(wait)).toBe(true);
    });

    it("stops waiting for keyboard-controller on Android after the timeout", async () => {
      mockIsAndroid = true;
      const hidden = deferred();
      jest.spyOn(KeyboardController, "dismiss").mockReturnValue(hidden.promise);

      const wait = waitForKeyboardDismiss(500);
      expect(await hasSettled(wait)).toBe(false);

      jest.advanceTimersByTime(500);
      expect(await hasSettled(wait)).toBe(true);
    });

    it("clears the Android timer when keyboard-controller resolves first", async () => {
      mockIsAndroid = true;
      const hidden = deferred();
      jest.spyOn(KeyboardController, "dismiss").mockReturnValue(hidden.promise);

      const wait = waitForKeyboardDismiss(500);
      hidden.resolve();
      expect(await hasSettled(wait)).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
