import Blockaid from "@blockaid/client";
import axios from "axios";
import { AnalyticsEvent } from "config/analyticsConfig";
import { isNativeAssetId } from "helpers/assetIdentity";
import { isMainnet } from "helpers/networks";
import { scrubStrKeys } from "helpers/stellarStrKey";
import { analytics } from "services/analytics";
import { freighterBackendV1 } from "services/backend";
import {
  BLOCKAID_ENDPOINTS,
  BLOCKAID_ERROR_MESSAGES,
  BLOCKAID_RESULT_TYPES,
  SecurityLevel,
} from "services/blockaid/constants";
import { assessSiteSecurity } from "services/blockaid/helper";
import {
  BlockaidApiResponse,
  ScanTokenParams,
  ScanSiteParams,
  ScanTransactionParams,
  ScanBulkTokensParams,
} from "services/blockaid/types";

/**
 * Blockaid scan targets for the consolidated `blockaid.scan_completed` /
 * `blockaid.scan_failed` events. The `scan_target` property discriminates
 * which kind of scan ran.
 */
type BlockaidScanTarget = "domain" | "transaction" | "asset" | "asset_bulk";

/**
 * Analytics `result` derived DIRECTLY from the raw Blockaid result_type — not
 * from the UI SecurityLevel. getSecurityLevel/assessTokenSecurity default a
 * missing or unrecognized result_type to SAFE for the UI (a deliberate
 * product choice), but for analytics that would inflate the `safe` bucket with
 * tokens Blockaid could not classify. Mirroring the extension's
 * toBlockaidResultLevel, an unclassifiable token is `unknown` on both
 * platforms. `Spam` maps to `warn`.
 */
const resultFromResultType = (
  resultType?: string,
): "safe" | "warn" | "block" | "unknown" => {
  switch (resultType) {
    case BLOCKAID_RESULT_TYPES.BENIGN:
      return "safe";
    case BLOCKAID_RESULT_TYPES.WARNING:
    case BLOCKAID_RESULT_TYPES.SPAM:
      return "warn";
    case BLOCKAID_RESULT_TYPES.MALICIOUS:
      return "block";
    default:
      return "unknown";
  }
};

/**
 * Reduces a bulk token scan to a single worst-case analytics `result`
 * (block > warn > safe > unknown), matching the extension's asset_bulk
 * aggregation over per-token result_type.
 */
const aggregateBulkResult = (
  scanResult: Blockaid.TokenBulkScanResponse,
): "safe" | "warn" | "block" | "unknown" => {
  const levels = Object.values(scanResult.results ?? {}).map((result) =>
    resultFromResultType(result?.result_type),
  );
  if (levels.includes("block")) return "block";
  if (levels.includes("warn")) return "warn";
  if (levels.includes("safe")) return "safe";
  return "unknown";
};

/**
 * Map the internal SecurityLevel to the shared cross-platform `result`
 * vocabulary (`safe | warn | block | unknown`) so blockaid.scan_completed.result
 * aligns with the extension.
 */
const toBlockaidResultLevel = (
  level: SecurityLevel,
): "safe" | "warn" | "block" | "unknown" => {
  switch (level) {
    case SecurityLevel.SAFE:
      return "safe";
    case SecurityLevel.SUSPICIOUS:
      return "warn";
    case SecurityLevel.MALICIOUS:
      return "block";
    default:
      return "unknown";
  }
};

/**
 * Emits the consolidated scan-failure event. Blockaid only runs on mainnet, so
 * the NETWORK_NOT_SUPPORTED short-circuit on other networks is an expected skip
 * rather than a scan failure and is not reported.
 */
const trackScanFailed = (
  scanTarget: BlockaidScanTarget,
  error: unknown,
): void => {
  if (axios.isCancel(error)) return;

  const reasonCode = error instanceof Error ? error.message : String(error);
  if (reasonCode === BLOCKAID_ERROR_MESSAGES.NETWORK_NOT_SUPPORTED) return;

  analytics.track(AnalyticsEvent.BLOCKAID_SCAN_FAILED, {
    scan_target: scanTarget,
    // Scrub StrKeys — a backend/validation error can echo a G…/C… address, and
    // this is the last raw error path (matches the other track*Error helpers).
    reason_code: scrubStrKeys(reasonCode) ?? reasonCode,
  });
};

const formatAddress = (tokenCode: string, tokenIssuer?: string): string => {
  if (tokenIssuer) {
    return `${tokenCode}-${tokenIssuer}`;
  }

  return tokenCode;
};

export const scanToken = async (
  params: ScanTokenParams,
): Promise<Blockaid.TokenScanResponse> => {
  const { tokenCode, tokenIssuer, network } = params;
  try {
    // Native XLM is trusted by default and isn't a scannable Blockaid address
    // (Blockaid rejects "XLM" / "native"), so short-circuit to a benign result
    // instead of calling the backend. The issuer must be absent too — a
    // non-native imposter coded "XLM" carries an issuer and is still scanned.
    if (isNativeAssetId(tokenCode) && !tokenIssuer) {
      return { result_type: "Benign" } as Blockaid.TokenScanResponse;
    }

    if (!isMainnet(network)) {
      throw new Error(BLOCKAID_ERROR_MESSAGES.NETWORK_NOT_SUPPORTED);
    }

    const address = formatAddress(tokenCode, tokenIssuer);

    const response = await freighterBackendV1.get<
      BlockaidApiResponse<Blockaid.TokenScanResponse>
    >(BLOCKAID_ENDPOINTS.SCAN_TOKEN, {
      params: {
        address,
      },
    });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    const scanResult = response.data.data as Blockaid.TokenScanResponse;

    analytics.track(AnalyticsEvent.BLOCKAID_SCAN_COMPLETED, {
      scan_target: "asset",
      result: resultFromResultType(scanResult.result_type),
      token_code: tokenCode,
    });

    return scanResult;
  } catch (error) {
    trackScanFailed("asset", error);
    throw new Error(BLOCKAID_ERROR_MESSAGES.TOKEN_SCAN_FAILED);
  }
};

export const scanBulkTokens = async (
  params: ScanBulkTokensParams,
  signal?: AbortSignal,
): Promise<Blockaid.TokenBulkScanResponse> => {
  const { addressList, network } = params;

  try {
    if (!isMainnet(network)) {
      throw new Error(BLOCKAID_ERROR_MESSAGES.NETWORK_NOT_SUPPORTED);
    }

    // Build URL with query parameters for bulk scanning
    const queryParams = addressList
      .map((address) => `asset_ids=${encodeURIComponent(address)}`)
      .join("&");
    const endpoint = `${BLOCKAID_ENDPOINTS.SCAN_BULK_TOKENS}?${queryParams}`;

    const response = await freighterBackendV1.get<
      BlockaidApiResponse<Blockaid.TokenBulkScanResponse>
    >(endpoint, { signal });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    const scanResult = response.data.data as Blockaid.TokenBulkScanResponse;

    analytics.track(AnalyticsEvent.BLOCKAID_SCAN_COMPLETED, {
      scan_target: "asset_bulk",
      // Aggregate verdict across the batch: the worst per-token result.
      result: aggregateBulkResult(scanResult),
      address_count: addressList.length,
    });

    return scanResult;
  } catch (error) {
    trackScanFailed("asset_bulk", error);
    // Rethrow cancellations untouched so callers can treat a superseded
    // request as benign; wrap everything else, preserving the cause.
    if (axios.isCancel(error)) throw error;
    const wrapped = new Error(
      BLOCKAID_ERROR_MESSAGES.BULK_TOKEN_SCAN_FAILED,
    ) as Error & {
      cause?: unknown;
    };
    wrapped.cause = error;
    throw wrapped;
  }
};

export const scanSite = async (
  params: ScanSiteParams,
): Promise<Blockaid.SiteScanResponse> => {
  const { url, network } = params;
  try {
    if (!isMainnet(network)) {
      throw new Error(BLOCKAID_ERROR_MESSAGES.NETWORK_NOT_SUPPORTED);
    }

    const response = await freighterBackendV1.get<
      BlockaidApiResponse<Blockaid.SiteScanResponse>
    >(BLOCKAID_ENDPOINTS.SCAN_SITE, {
      params: {
        url,
      },
    });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    const scanResult = response.data.data as Blockaid.SiteScanResponse;

    analytics.track(AnalyticsEvent.BLOCKAID_SCAN_COMPLETED, {
      scan_target: "domain",
      result: toBlockaidResultLevel(assessSiteSecurity(scanResult).level),
    });

    return scanResult;
  } catch (error) {
    trackScanFailed("domain", error);
    throw new Error(BLOCKAID_ERROR_MESSAGES.SITE_SCAN_FAILED);
  }
};

export const scanTransaction = async (
  params: ScanTransactionParams,
): Promise<Blockaid.StellarTransactionScanResponse> => {
  const { xdr, url, network } = params;

  try {
    if (!isMainnet(network)) {
      throw new Error(BLOCKAID_ERROR_MESSAGES.NETWORK_NOT_SUPPORTED);
    }

    const transactionParams = {
      url,
      tx_xdr: xdr,
      network,
    };

    const response = await freighterBackendV1.post<
      BlockaidApiResponse<Blockaid.StellarTransactionScanResponse>
    >(BLOCKAID_ENDPOINTS.SCAN_TRANSACTION, transactionParams);

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    const scanResult = response.data
      .data as Blockaid.StellarTransactionScanResponse;

    // Derive from the raw validation.result_type (missing/unrecognized ->
    // "unknown"), NOT assessTransactionSecurity().level — the UI model defaults
    // unclassifiable results to SAFE and maps simulation.error to SUSPICIOUS,
    // both of which would diverge from the extension (which reads the raw
    // result_type and ignores simulation). Guard the validation union exactly
    // like the extension's `"result_type" in validation` check. Mirrors mobile's
    // own token path (resultFromResultType) so all scan targets bucket alike.
    const { validation } = scanResult;
    const validationResultType =
      validation && "result_type" in validation
        ? validation.result_type
        : undefined;

    analytics.track(AnalyticsEvent.BLOCKAID_SCAN_COMPLETED, {
      scan_target: "transaction",
      result: resultFromResultType(validationResultType),
    });

    return scanResult;
  } catch (error) {
    trackScanFailed("transaction", error);
    throw new Error(BLOCKAID_ERROR_MESSAGES.TRANSACTION_SCAN_FAILED);
  }
};
