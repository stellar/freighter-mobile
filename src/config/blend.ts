import { NETWORKS, NetworkDetails } from "config/constants";

/**
 * The Blend v2.1 Fixed pool per network: "Fixed v2.1" on mainnet and
 * "Testnet v2.1" on testnet. They run the same pool contract code as the v2
 * pools they replace, so the request encoding and the `submit` call are
 * unchanged.
 *
 * These mirror the allowlist in freighter-backend-v2 `configs/earn-pools.json`,
 * which is what filters the `/protocols/blend/earn-options` response. Keep the
 * two in sync.
 *
 * Networks absent from this map do not support Earn — see `isEarnSupportedNetwork`.
 */
export const BLEND_FIXED_POOL_IDS: Partial<Record<NETWORKS, string>> = {
  [NETWORKS.PUBLIC]: "CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO",
  [NETWORKS.TESTNET]:
    "CB3447A446DY3USGWPIDXTNQHF5EX24XDQA2EN6TAZP62JTPBTNOA52Q",
};

export const getBlendPoolId = (networkDetails: NetworkDetails) =>
  BLEND_FIXED_POOL_IDS[networkDetails.network];

/**
 * Earn is only available where we have an allowlisted pool. The backend's Blend
 * routes also reject any `?network=` outside PUBLIC/TESTNET, so gating here keeps
 * the flow to a single code path with no custom-network fallback.
 */
export const isEarnSupportedNetwork = (networkDetails: NetworkDetails) =>
  Boolean(getBlendPoolId(networkDetails));
