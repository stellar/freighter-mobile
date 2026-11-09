import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import {
  useWalletSetupOverlayStore,
  walletSetupClock,
} from "ducks/walletSetupOverlay";
import { useEffect } from "react";

/** "Your wallet is ready!" stays up at least this long, so it can be read. */
export const READY_MIN_MS = 1000;
/** And at most this long, so a slow or stalled balances fetch can't hold it. */
export const READY_MAX_MS = 3000;
/**
 * How long setup may run on after the app is authenticated before the screen
 * turns ready anyway. By then the wallet is stored and Home is mounted
 * beneath, and what's left is signUp loading the account (it awaits
 * fetchActiveAccount). A stall there mustn't keep the screen up.
 */
export const SETUP_AFTER_AUTH_MAX_MS = 5000;
/**
 * The same, while the auth store is still loading. The app's periodic auth
 * check can see an imported wallet on disk before importWallet has finished
 * searching the network for the wallet's other accounts. Until it has, the
 * screen keeps saying "Importing your wallet...", but no longer than this:
 * a search that stalls (Android sets no timeout) mustn't keep it up either.
 */
export const SETUP_STILL_LOADING_AFTER_AUTH_MAX_MS = 20000;

interface BalancesLoadState {
  fetchedPublicKey: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Whether Home's balances for the new wallet have finished loading, or
 * failed to: either way Home now shows what it will show. Setup clears the
 * balances store, so a fetch for an earlier wallet can't count.
 */
export const selectAreBalancesSettled = (
  activePublicKey: string | undefined,
  { fetchedPublicKey, isLoading, error }: BalancesLoadState,
): boolean =>
  !!activePublicKey &&
  !isLoading &&
  (fetchedPublicKey === activePublicKey || !!error);

/**
 * Takes the wallet setup screen away once it's ready: as soon as Home's
 * balances are in, but not before it has been ready for READY_MIN_MS, and
 * no later than READY_MAX_MS.
 *
 * Both limits count from the store's `readyAt`, not from when this mounted,
 * so a remount (RootNavigator can swap its tree out and back) doesn't
 * restart the wait.
 */
export const useWalletSetupOverlayExit = (): void => {
  const phase = useWalletSetupOverlayStore((state) => state.phase);
  const readyAt = useWalletSetupOverlayStore((state) => state.readyAt);
  const leave = useWalletSetupOverlayStore((state) => state.leave);
  const succeed = useWalletSetupOverlayStore((state) => state.succeed);
  const isAuthenticated = useAuthenticationStore(
    (state) => state.authStatus === AUTH_STATUS.AUTHENTICATED,
  );
  const isAuthLoading = useAuthenticationStore((state) => state.isLoading);
  // From the store rather than useGetActiveAccount, which has effects of its
  // own.
  const activePublicKey = useAuthenticationStore(
    (state) => state.account?.publicKey,
  );
  const areBalancesSettled = useBalancesStore((state) =>
    selectAreBalancesSettled(activePublicKey, state),
  );

  useEffect(() => {
    if (phase !== "settingUp" || !isAuthenticated) return undefined;

    // succeed() only acts while setting up, so if setup settles first, this
    // does nothing; a failure reported after it still shows its toast.
    const timeout = setTimeout(
      succeed,
      isAuthLoading
        ? SETUP_STILL_LOADING_AFTER_AUTH_MAX_MS
        : SETUP_AFTER_AUTH_MAX_MS,
    );
    return () => clearTimeout(timeout);
  }, [isAuthLoading, isAuthenticated, phase, succeed]);

  useEffect(() => {
    if (phase !== "ready" || readyAt === null) return undefined;

    const limit = areBalancesSettled ? READY_MIN_MS : READY_MAX_MS;
    const timeout = setTimeout(
      leave,
      Math.max(0, readyAt + limit - walletSetupClock()),
    );

    return () => clearTimeout(timeout);
  }, [areBalancesSettled, leave, phase, readyAt]);
};
