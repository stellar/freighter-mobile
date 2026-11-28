import { BlendPoolPosition } from "config/blendTypes";
import { useAuthenticationStore } from "ducks/auth";
import { positionsKeyFor, usePositionsStore } from "ducks/positions";
import useGetActiveAccount from "hooks/useGetActiveAccount";

const NO_POSITIONS: BlendPoolPosition[] = [];

export interface AccountPositions {
  positions: BlendPoolPosition[];
  /** A read of this account's positions has succeeded at least once. */
  hasLoaded: boolean;
  /** Set only while there is nothing good to show (see the store). */
  error: string | null;
}

/**
 * The active account's positions on the active network. The store keeps one
 * account's at a time, so whatever it holds for another account or network
 * reads as not loaded yet, never as this account's.
 */
export const useAccountPositions = (): AccountPositions => {
  const { account } = useGetActiveAccount();
  const network = useAuthenticationStore((state) => state.network);
  const fetchedKey = usePositionsStore((state) => state.fetchedKey);
  const positions = usePositionsStore((state) => state.positions);
  const hasLoaded = usePositionsStore((state) => state.hasLoaded);
  const error = usePositionsStore((state) => state.error);

  const isCurrent =
    !!account?.publicKey &&
    fetchedKey === positionsKeyFor(account.publicKey, network);

  return {
    positions: isCurrent ? positions : NO_POSITIONS,
    hasLoaded: isCurrent && hasLoaded,
    error: isCurrent ? error : null,
  };
};
