import {
  runWithWalletSetupOverlay,
  useWalletSetupOverlayStore,
} from "ducks/walletSetupOverlay";

const store = () => useWalletSetupOverlayStore.getState();

describe("walletSetupOverlay", () => {
  beforeEach(() => {
    useWalletSetupOverlayStore.setState(
      useWalletSetupOverlayStore.getInitialState(),
      true,
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it("starts hidden", () => {
    expect(store().phase).toBe("hidden");
    expect(store().readyAt).toBeNull();
  });

  it("begins setting up with the flow", () => {
    store().begin("import");

    expect(store().phase).toBe("settingUp");
    expect(store().flow).toBe("import");
  });

  it("turns ready on success and records when", () => {
    jest.spyOn(performance, "now").mockReturnValue(5000);

    store().begin("create");
    store().succeed();

    expect(store().phase).toBe("ready");
    expect(store().readyAt).toBe(5000);
  });

  it("leaves on failure, then hides once the fade is done", () => {
    store().begin("create");
    store().fail();
    expect(store().phase).toBe("leaving");

    store().finishLeaving();
    expect(store().phase).toBe("hidden");
    expect(store().readyAt).toBeNull();
  });

  it("leaves once ready when told to", () => {
    store().begin("create");
    store().succeed();
    store().leave();

    expect(store().phase).toBe("leaving");
  });

  describe("ignores out-of-order calls", () => {
    it("stays hidden when success or failure comes without a setup", () => {
      store().succeed();
      expect(store().phase).toBe("hidden");

      store().fail();
      expect(store().phase).toBe("hidden");

      store().leave();
      expect(store().phase).toBe("hidden");
    });

    it("stays ready when a failure arrives after success", () => {
      store().begin("create");
      store().succeed();
      store().fail();

      expect(store().phase).toBe("ready");
    });

    it("keeps the setup it has when another begins", () => {
      store().begin("create");
      store().begin("import");
      expect(store().phase).toBe("settingUp");
      expect(store().flow).toBe("create");

      store().succeed();
      store().begin("import");
      expect(store().phase).toBe("ready");
      expect(store().flow).toBe("create");
    });

    it("doesn't hide a screen that isn't fading out", () => {
      store().begin("create");
      store().finishLeaving();
      expect(store().phase).toBe("settingUp");

      store().succeed();
      store().finishLeaving();
      expect(store().phase).toBe("ready");
    });
  });

  // A retry right after a failure must not be hidden by the old fade.
  it("starts again when a retry begins during the fade", () => {
    store().begin("import");
    store().fail();
    store().begin("create");

    expect(store().phase).toBe("settingUp");
    expect(store().flow).toBe("create");
    expect(store().readyAt).toBeNull();

    store().finishLeaving();
    expect(store().phase).toBe("settingUp");
  });

  describe("runWithWalletSetupOverlay", () => {
    it("shows the screen while setup runs and turns ready when it resolves true", async () => {
      let finish: (value: boolean) => void = () => {};
      const setup = () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        });

      const result = runWithWalletSetupOverlay("create", setup);
      expect(store().phase).toBe("settingUp");
      expect(store().flow).toBe("create");

      finish(true);

      await expect(result).resolves.toBe(true);
      expect(store().phase).toBe("ready");
    });

    it("fails the screen when setup resolves false", async () => {
      await expect(
        runWithWalletSetupOverlay("import", () => Promise.resolve(false)),
      ).resolves.toBe(false);

      expect(store().phase).toBe("leaving");
    });

    it("fails the screen and rethrows when setup throws", async () => {
      const error = new Error("setup broke");

      await expect(
        runWithWalletSetupOverlay("create", () => Promise.reject(error)),
      ).rejects.toBe(error);

      expect(store().phase).toBe("leaving");
    });
  });
});
