import { NETWORKS } from "config/constants";
import { useRemoteConfigStore } from "ducks/remoteConfig";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/**
 * The single gate for the whole price-history block (chart, Stats, About):
 * the kill switch AND mainnet. In one place on purpose — the three sections
 * used to gate themselves inconsistently, and the switch lived only in the
 * screen wrapper, so any future embed would have fetched with it OFF.
 *
 * Gated on `isInitialized`, not the flag alone, so it fails CLOSED: the flag
 * renders before `fetchFeatureFlags` settles, and reading it bare would mount
 * the block for the first few hundred ms of exactly the incident the switch
 * exists for. The store sets `isInitialized` on failure too, so an
 * unreachable Amplitude cannot wedge the feature off.
 */
const usePriceHistoryEnabled = (network: NETWORKS): boolean => {
  const isInitialized = useRemoteConfigStore((state) => state.isInitialized);
  const isFlagEnabled = useRemoteConfigStore(
    (state) => state.use_token_price_history,
  );

  return isInitialized && isFlagEnabled && network === NETWORKS.PUBLIC;
};

export default usePriceHistoryEnabled;
