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
import { getIconUrl } from "helpers/getIconUrl";

/**
 * Processes a single asset balance change
 */
async function processAssetChange(
  change: AssetBalanceChange,
  publicKey: string,
  networkDetails: NetworkDetails,
): Promise<AssetDiffSummary | null> {
  try {
    const isCredit = change.to === publicKey;
    const destination = isCredit ? change.from : change.to;

    // Determine asset details
    let assetCode: string;
    let assetIssuer: string | null = null;
    const decimals = DEFAULT_DECIMALS;

    if (change.asset_type === "native") {
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
 * 1. Filters changes to only those involving the user's account
 * 2. Determines direction (credit vs debit)
 * 3. Fetches icons for proper display
 * 4. Returns formatted summaries for UI rendering
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

  if (changes.length === 0) {
    return [];
  }

  // Process each change into a summary
  const summaries = await Promise.all(
    changes.map((change) =>
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
