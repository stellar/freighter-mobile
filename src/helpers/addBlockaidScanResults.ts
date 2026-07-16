import Blockaid from "@blockaid/client";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { Balance, BalanceMap } from "config/types";
import { useBlockaidTokenScansStore } from "ducks/blockaidTokenScans";
import { MappedAccountBalances } from "helpers/mapAccountBalancesV2";
import { isMainnet } from "helpers/networks";

type ScannableBalance = Balance & {
  blockaidData?: Blockaid.Token.TokenScanResponse;
};

/**
 * Stamps `blockaidData` onto every mapped v2 balance entry so the v2 path
 * returns the same payload as v1, where the v1 backend does this server-side
 * (`freighter-backend/src/service/blockaid/helpers/addScanResults.ts`):
 * every entry gets a benign default, then a mainnet bulk scan overwrites the
 * entries Blockaid returns verdicts for. `scanToken`
 * (`services/blockaid/api.ts`) is the client-side precedent: native XLM is
 * benign by definition and LP-share ids are not scannable assets, so they are
 * excluded from the request and native keeps the benign default.
 *
 * Scan failures never break balances — entries keep the benign default,
 * mirroring v1.
 */
export const addBlockaidScanResults = async (
  accountBalances: MappedAccountBalances,
  network: NETWORKS,
): Promise<MappedAccountBalances> => {
  const balances: BalanceMap = accountBalances.balances || {};
  const keys = Object.keys(balances);

  keys.forEach((key) => {
    // LP-share entries have no token identity to scan and no blockaidData
    // field on their type — skip them (v1 leaves them unstamped too).
    if (key.endsWith(":lp")) {
      return;
    }
    (balances[key] as ScannableBalance).blockaidData = {
      result_type: "Benign",
    } as Blockaid.Token.TokenScanResponse;
  });

  // Balance-map keys are `CODE:ISSUER` / `SYMBOL:CONTRACT_ID`; Blockaid ids
  // swap the separator: `CODE-ISSUER` (same convention as
  // extractScanResultsFromBalances and scanToken's formatAddress).
  const scannableIds = keys.filter(
    (key) => key !== NATIVE_TOKEN_CODE && !key.endsWith(":lp"),
  );

  if (!isMainnet(network) || !scannableIds.length) {
    // Blockaid only supports Stellar mainnet; on other networks every entry
    // keeps the benign default.
    return accountBalances;
  }

  try {
    // This runs on every balance poll (every 30s), so it must go through the
    // disk-backed scan cache: warm polls are a local read — no Blockaid call,
    // no analytics event — and only cache misses (30-min TTL) hit the network.
    // The swap flow shares the same cache and `CODE-ISSUER` key format.
    const { results } = await useBlockaidTokenScansStore
      .getState()
      .scanBulkWithCache({
        addressList: scannableIds.map((id) => id.replace(":", "-")),
        network,
      });

    Object.entries(results || {}).forEach(([assetId, scanResult]) => {
      const balanceKey = assetId.replace("-", ":");
      if (balances[balanceKey]) {
        (balances[balanceKey] as ScannableBalance).blockaidData = scanResult;
      }
    });
  } catch (error) {
    // Non-fatal: spam/scam badges fall back to benign defaults.
    // scanBulkWithCache already swallows Blockaid failures (degrading to
    // cached hits), so this only catches storage-level errors.
    logger.warn(
      "addBlockaidScanResults",
      "Failed to bulk scan v2 balances",
      error,
    );
  }

  return accountBalances;
};
