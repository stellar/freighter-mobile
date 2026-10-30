import { Horizon } from "@stellar/stellar-sdk";
import {
  AssetBalanceChange,
  AssetDiffSummary,
} from "components/screens/HistoryScreen/types";
import {
  DEFAULT_DECIMALS,
  NATIVE_TOKEN_CODE,
  NetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import { isNativeAssetId } from "helpers/assetIdentity";
import { getIconUrl } from "helpers/getIconUrl";
import { buildMuxedContract } from "helpers/muxedContract";
import { isContractId } from "helpers/soroban";

/**
 * Gets the address to show as the destination of a debit.
 *
 * For a transfer to a muxed contract (`W…`), Horizon reports the base contract
 * (`C…`) in `to` and the mux id in `destination_muxed_id`, so the `W…` is
 * rebuilt from the two. Only contracts are rebuilt: any other `to`, such as a
 * `G…`, is returned as is. Use it for a debit only. On a credit the mux id
 * belongs to the user's own address, not to the counterparty.
 *
 * Display only. Which changes involve the user, and whether one is a credit or
 * a debit, are still decided on the raw `from` and `to`, which this never
 * rewrites.
 *
 * Never throws: an id that doesn't build (not a decimal uint64, or out of
 * range) is logged and `to` is shown instead, so one malformed id can't drop
 * the row. An empty id is absent rather than invalid, so it isn't logged.
 *
 * @param change - A balance change in which the user is the sender.
 * @returns The `W…` for a debit to a muxed contract, otherwise `change.to`.
 */
function getDebitDestination(change: AssetBalanceChange): string {
  if (!change.destination_muxed_id || !isContractId(change.to)) {
    return change.to;
  }

  try {
    return buildMuxedContract(change.to, change.destination_muxed_id);
  } catch (error) {
    logger.error("getDebitDestination", "Invalid destination_muxed_id", error);

    return change.to;
  }
}

/**
 * Processes a single asset balance change
 *
 * The direction is decided on the raw addresses: it is a credit when `to` is
 * the user's key. `destination` is the counterparty: `from` for a credit and
 * `to` for a debit, except that a debit to a muxed contract shows the rebuilt
 * `W…` (see `getDebitDestination`). `destination` is omitted when it equals
 * the user's key.
 */
async function processAssetChange(
  change: AssetBalanceChange,
  publicKey: string,
  networkDetails: NetworkDetails,
): Promise<AssetDiffSummary | null> {
  try {
    const isCredit = change.to === publicKey;
    const destination = isCredit ? change.from : getDebitDestination(change);

    // Determine asset details
    let assetCode: string;
    let assetIssuer: string | null = null;
    const decimals = DEFAULT_DECIMALS;

    if (isNativeAssetId(change.asset_type)) {
      assetCode = NATIVE_TOKEN_CODE;
    } else if (
      change.asset_type === "credit_alphanum4" ||
      change.asset_type === "credit_alphanum12"
    ) {
      assetCode = change.asset_code || "";
      assetIssuer = change.asset_issuer || null;
    } else {
      // Unknown asset type
      logger.error(
        "processAssetChange",
        `Unknown asset type: ${change.asset_type}`,
        change,
      );
      return null;
    }

    // Fetch icon
    let icon: string | undefined;
    try {
      icon = await getIconUrl({
        asset: {
          code: assetCode,
          issuer: assetIssuer || undefined,
        },
        network: networkDetails.network,
      });
    } catch (error) {
      // Icon fetch failed, continue without icon
      logger.error(
        "processAssetChange",
        `Failed to fetch icon for ${assetCode}`,
        error,
      );
      icon = undefined;
    }

    return {
      assetCode,
      assetIssuer,
      decimals,
      amount: change.amount,
      isCredit,
      destination: destination !== publicKey ? destination : undefined,
      icon,
    };
  } catch (error) {
    logger.error("processAssetChange", "Failed to process asset change", error);
    return null;
  }
}

/**
 * Processes asset_balance_changes from Horizon API into display-ready summaries
 *
 * This function:
 * 1. Processes all asset balance changes returned by Horizon
 * 2. Determines direction (credit vs debit) based on whether the change's `to` matches the provided publicKey
 * 3. Fetches icons for proper display
 * 4. Returns formatted summaries for UI rendering
 *
 * The user is matched on the raw `from` and `to`, as Horizon reports them. Only
 * the `destination` shown for a debit to a muxed contract is rebuilt: the `W…`
 * made from the base `C…` in `to` and the `destination_muxed_id` (see
 * `getDebitDestination`).
 */
export async function processAssetBalanceChanges(
  operation: Horizon.ServerApi.OperationRecord,
  publicKey: string,
  networkDetails: NetworkDetails,
): Promise<AssetDiffSummary[]> {
  // Extract asset_balance_changes from operation, only in InvokeHostFunctionOperationRecord
  if (!("asset_balance_changes" in operation)) {
    return [];
  }
  const changes = operation.asset_balance_changes;

  if (!changes || changes.length === 0) {
    return [];
  }

  // Filter to only include changes where the user is involved (as sender or receiver)
  const relevantChanges = changes.filter(
    (change) => change.to === publicKey || change.from === publicKey,
  );

  if (relevantChanges.length === 0) {
    return [];
  }

  // Process each change into a summary
  const summaries = await Promise.all(
    relevantChanges.map((change) =>
      processAssetChange(change, publicKey, networkDetails),
    ),
  );

  return summaries.filter((s): s is AssetDiffSummary => s !== null);
}

/**
 * Normalizes regular payment data into AssetDiffSummary format
 * Used when operation doesn't have asset_balance_changes from Horizon
 *
 * This ensures ALL payments use the unified credit/debit view,
 * matching the web extension behavior
 */
export async function normalizePaymentToAssetDiffs(params: {
  amount: string;
  assetCode: string;
  assetIssuer: string | null;
  isCredit: boolean;
  destination: string;
  networkDetails: NetworkDetails;
}): Promise<AssetDiffSummary[]> {
  const {
    amount,
    assetCode,
    assetIssuer,
    isCredit,
    destination,
    networkDetails,
  } = params;

  // Fetch icon for the asset
  let icon: string | undefined;
  try {
    icon = await getIconUrl({
      asset: {
        code: assetCode,
        issuer: assetIssuer || undefined,
      },
      network: networkDetails.network,
    });
  } catch (error) {
    logger.error(
      "normalizePaymentToAssetDiffs",
      `Failed to fetch icon for ${assetCode}`,
      error,
    );
    icon = undefined;
  }

  return [
    {
      assetCode,
      assetIssuer,
      decimals: DEFAULT_DECIMALS,
      amount,
      isCredit,
      destination,
      icon,
    },
  ];
}
