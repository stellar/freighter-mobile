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
});
