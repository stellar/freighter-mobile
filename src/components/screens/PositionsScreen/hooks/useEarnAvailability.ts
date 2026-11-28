import { isEarnSupportedNetwork } from "config/blend";
import { mapNetworkToNetworkDetails } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useRemoteConfigStore } from "ducks/remoteConfig";

/**
 * Whether deposits into Earn are offered: the `earn_deposit` flag, on a
 * network with an allowlisted Blend pool. The flag is read only once the
 * flags have loaded, so no entry point shows before Amplitude could turn it
 * off; a failed fetch also counts as loaded, so it can't stay hidden forever.
 */
export const useIsEarnDepositAvailable = (): boolean => {
  const network = useAuthenticationStore((state) => state.network);
  const isFlagOn = useRemoteConfigStore(
    (state) => state.isInitialized && state.earn_deposit,
  );
  return (
    isFlagOn && isEarnSupportedNetwork(mapNetworkToNetworkDetails(network))
  );
};

/**
 * Whether Home shows the Positions tab: the `positions_enabled` flag, on a
 * network Earn supports. Independent of `earn_deposit`, as in the extension:
 * with deposits off, positions already held still show.
 */
export const useArePositionsAvailable = (): boolean => {
  const network = useAuthenticationStore((state) => state.network);
  const isFlagOn = useRemoteConfigStore(
    (state) => state.isInitialized && state.positions_enabled,
  );
  return (
    isFlagOn && isEarnSupportedNetwork(mapNetworkToNetworkDetails(network))
  );
};
