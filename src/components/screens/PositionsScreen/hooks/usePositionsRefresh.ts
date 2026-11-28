import { useFocusEffect } from "@react-navigation/native";
import {
  AWAITED_DEPOSIT_POLL_MS,
  hasDepositLanded,
} from "components/screens/PositionsScreen/helpers/awaitedDeposit";
import {
  BALANCES_FETCH_POLLING_INTERVAL,
  NETWORKS,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { positionsKeyFor, usePositionsStore } from "ducks/positions";
import { useCallback, useEffect } from "react";

/** Positions refresh on the balances' cadence, as in the extension. */
export const POSITIONS_REFRESH_MS = BALANCES_FETCH_POLLING_INTERVAL;

interface PositionsRefreshParams {
  publicKey: string | undefined;
  network: NETWORKS;
  /** Positions are on for this network (see `useArePositionsAvailable`). */
  isAvailable: boolean;
}

/**
 * Keeps the positions fresh while the calling screen is focused: Home, and
 * the pool and token screens it opens, which read the same store. Reads at
 * once when the last read is older than the interval (or another account's),
 * otherwise when the interval runs out, then every interval while focused.
 *
 * Also reads the pool catalog once per network, which a token's Deposit
 * needs, and the earn catalog once positions land empty, which only the
 * empty tab's "Earn up to" uses.
 */
export const usePositionsRefresh = ({
  publicKey,
  network,
  isAvailable,
}: PositionsRefreshParams) => {
  const fetchPositions = usePositionsStore((state) => state.fetchPositions);
  const fetchPools = usePositionsStore((state) => state.fetchPools);
  const fetchEarnOptions = usePositionsStore((state) => state.fetchEarnOptions);
  const poolsNetwork = usePositionsStore((state) => state.poolsNetwork);
  const earnOptionsNetwork = usePositionsStore(
    (state) => state.earnOptionsNetwork,
  );
  const fetchedKey = usePositionsStore((state) => state.fetchedKey);
  const hasLoaded = usePositionsStore((state) => state.hasLoaded);
  const isEmpty = usePositionsStore((state) => state.positions.length === 0);

  useFocusEffect(
    useCallback(() => {
      if (!isAvailable || !publicKey) {
        return undefined;
      }

      const read = () => {
        fetchPositions({ publicKey, network }).catch(() => {
          // The store reports its own failures.
        });
      };

      const { fetchedKey: lastKey, lastReadStartedAt } =
        usePositionsStore.getState();
      const lastReadAt =
        lastKey === positionsKeyFor(publicKey, network) ? lastReadStartedAt : 0;
      const wait = Math.max(0, lastReadAt + POSITIONS_REFRESH_MS - Date.now());

      let intervalId: ReturnType<typeof setInterval> | undefined;
      const timeoutId = setTimeout(() => {
        read();
        intervalId = setInterval(read, POSITIONS_REFRESH_MS);
      }, wait);

      return () => {
        clearTimeout(timeoutId);
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }, [isAvailable, publicKey, network, fetchPositions]),
  );

  useEffect(() => {
    if (isAvailable && poolsNetwork !== network) {
      fetchPools(network).catch(() => {
        // The store reports its own failures.
      });
    }
  }, [isAvailable, poolsNetwork, network, fetchPools]);

  const hasLoadedEmpty =
    !!publicKey &&
    fetchedKey === positionsKeyFor(publicKey, network) &&
    hasLoaded &&
    isEmpty;

  useEffect(() => {
    if (isAvailable && hasLoadedEmpty && earnOptionsNetwork !== network) {
      fetchEarnOptions(network).catch(() => {
        // The store reports its own failures.
      });
    }
  }, [
    isAvailable,
    hasLoadedEmpty,
    earnOptionsNetwork,
    network,
    fetchEarnOptions,
  ]);
};

/**
 * Follows a deposit that just landed until Positions show it: the positions
 * indexer can trail the ledger by a few seconds, so the account's positions
 * are re-read every few seconds, each read going on screen, until the
 * deposited token reaches the balance the deposit should have brought it to,
 * or the wait expires. It always reads at least once, even after expiry.
 *
 * Runs while the caller is mounted, focused or not: Home mounts it, and a
 * deposit's Done or close returns there.
 */
export const useAwaitedDepositFollow = ({
  publicKey,
  network,
  isAvailable,
}: PositionsRefreshParams) => {
  const awaitedDeposit = usePositionsStore((state) => state.awaitedDeposit);
  const fetchPositions = usePositionsStore((state) => state.fetchPositions);
  const setAwaitedDeposit = usePositionsStore(
    (state) => state.setAwaitedDeposit,
  );

  useEffect(() => {
    if (
      !isAvailable ||
      !publicKey ||
      !awaitedDeposit ||
      awaitedDeposit.publicKey !== publicKey ||
      awaitedDeposit.network !== network
    ) {
      return undefined;
    }

    const networkDetails = mapNetworkToNetworkDetails(network);
    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      const positions = await fetchPositions({ publicKey, network });
      if (isCancelled) {
        return;
      }
      if (
        positions &&
        hasDepositLanded(positions, awaitedDeposit, networkDetails)
      ) {
        setAwaitedDeposit(null);
        return;
      }
      if (Date.now() >= awaitedDeposit.expiresAt) {
        setAwaitedDeposit(null);
        return;
      }
      timer = setTimeout(() => {
        check().catch(() => {
          // The store reports its own failures.
        });
      }, AWAITED_DEPOSIT_POLL_MS);
    };

    check().catch(() => {
      // The store reports its own failures.
    });

    return () => {
      isCancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    isAvailable,
    publicKey,
    network,
    awaitedDeposit,
    fetchPositions,
    setAwaitedDeposit,
  ]);
};
