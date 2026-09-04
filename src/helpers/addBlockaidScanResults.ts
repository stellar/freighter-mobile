import Blockaid from "@blockaid/client";
import { isNativeAssetId, NETWORKS } from "config/constants";
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
  //
  // Remember which balance key produced each id rather than converting the id
  // back afterwards. The reverse direction is ambiguous: a SEP-41 `symbol()`
  // is an unconstrained String, so `MY-TOKEN:C…` becomes `MY-TOKEN-C…` and no
  // split rule recovers the original. Since `scanBulkWithCache` keys its
  // results by exactly the strings we send, this lookup cannot drift.
  const scanIdToBalanceKey = new Map<string, string>();
  keys.forEach((key) => {
    if (isNativeAssetId(key) || key.endsWith(":lp")) {
      return;
    }
    scanIdToBalanceKey.set(key.replace(":", "-"), key);
  });

  if (!isMainnet(network) || !scanIdToBalanceKey.size) {
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
        addressList: Array.from(scanIdToBalanceKey.keys()),
        network,
      });

    Object.entries(results || {}).forEach(([assetId, scanResult]) => {
      const balanceKey = scanIdToBalanceKey.get(assetId);
      if (!balanceKey) {
        // Every entry is pre-stamped benign, so a discarded verdict is an
        // affirmative "safe" claim rather than a missing badge — never let one
        // pass silently.
        logger.warn(
          "addBlockaidScanResults",
          `Discarded scan result for unrecognized asset id: ${assetId}`,
        );
        return;
      }
      (balances[balanceKey] as ScannableBalance).blockaidData = scanResult;
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
