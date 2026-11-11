import { create } from "zustand";

/** Which wallet the screen is setting up: a new one or an import. */
export type WalletSetupFlow = "create" | "import";

/**
 * Where the wallet setup screen is:
 * - `hidden`: not on screen;
 * - `settingUp`: "Creating your wallet..." or "Importing your wallet...";
 * - `ready`: "Your wallet is ready!", over a Home that's loading;
 * - `leaving`: fading out, after success or a failure.
 */
export type WalletSetupOverlayPhase =
  | "hidden"
  | "settingUp"
  | "ready"
  | "leaving";

/**
 * The clock the wait for Home is measured on. It only moves forward, unlike
 * `Date.now()`, so setting the device's time back, as a network time update
 * can, doesn't stretch the wait.
 */
export const walletSetupClock = (): number => performance.now();

interface WalletSetupOverlayState {
  phase: WalletSetupOverlayPhase;
  flow: WalletSetupFlow;
  /**
   * When setup succeeded, by `walletSetupClock`; the wait for Home counts
   * from it.
   */
  readyAt: number | null;

  /** Setup started. Also takes over a fade-out, so a retry stays on screen. */
  begin: (flow: WalletSetupFlow) => void;
  succeed: () => void;
  fail: () => void;
  /** Home is ready enough to be seen. */
  leave: () => void;
  /** The fade-out is done. */
  finishLeaving: () => void;
}

/**
 * The wallet setup screen's state, in memory only. It never holds the
 * recovery phrase or the password.
 *
 * Each action moves the screen on from one phase only and does nothing in
 * any other, so a late or repeated call can't put it back on screen or hide
 * it early. For example, a failure reported after success, or a fade-out
 * finishing after a retry began.
 */
export const useWalletSetupOverlayStore = create<WalletSetupOverlayState>()(
  (set, get) => ({
    phase: "hidden",
    flow: "create",
    readyAt: null,

    begin: (flow) => {
      const { phase } = get();
      if (phase !== "hidden" && phase !== "leaving") return;

      set({ phase: "settingUp", flow, readyAt: null });
    },

    succeed: () => {
      if (get().phase !== "settingUp") return;

      set({ phase: "ready", readyAt: walletSetupClock() });
    },

    fail: () => {
      if (get().phase !== "settingUp") return;

      set({ phase: "leaving" });
    },

    leave: () => {
      if (get().phase !== "ready") return;

      set({ phase: "leaving" });
    },

    finishLeaving: () => {
      if (get().phase !== "leaving") return;

      set({ phase: "hidden", readyAt: null });
    },
  }),
);

/**
 * Runs the last onboarding step's setup (`signUp` or `importWallet`) behind
 * the wallet setup screen: shows it, then turns it to "ready" if setup
 * resolves true, or fades it away otherwise.
 *
 * It owns the outcome in a `finally`, so whatever the setup does, including
 * throwing, the screen never stays up. It also works after the screen that
 * called it has unmounted, as the onboarding screens do once the app moves
 * to Home mid-setup. It resolves and rejects as `setup` does, so callers
 * keep their own error handling.
 */
export const runWithWalletSetupOverlay = async (
  flow: WalletSetupFlow,
  setup: () => Promise<boolean>,
): Promise<boolean> => {
  useWalletSetupOverlayStore.getState().begin(flow);

  let succeeded = false;
  try {
    succeeded = await setup();
    return succeeded;
  } finally {
    const { succeed, fail } = useWalletSetupOverlayStore.getState();
    if (succeeded) {
      succeed();
    } else {
      fail();
    }
  }
};
