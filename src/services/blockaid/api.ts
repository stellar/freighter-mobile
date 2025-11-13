import Blockaid from "@blockaid/client";
import { AnalyticsEvent } from "config/analyticsConfig";
import { isMainnet } from "helpers/networks";
import { analytics } from "services/analytics";
import { freighterBackendV1 } from "services/backend";
import {
  BLOCKAID_ENDPOINTS,
  BLOCKAID_ERROR_MESSAGES,
} from "services/blockaid/constants";
import {
  BlockaidApiResponse,
  ScanTokenParams,
  ScanSiteParams,
  ScanTransactionParams,
  ScanBulkTokensParams,
} from "services/blockaid/types";

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

    analytics.track(AnalyticsEvent.BLOCKAID_TOKEN_SCAN, {
      tokenCode,
      network,
    });

    return scanResult;
  } catch (error) {
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

    analytics.track(AnalyticsEvent.BLOCKAID_BULK_TOKEN_SCAN, {
      addressList,
      network,
    });

    return scanResult;
  } catch (error) {
    throw new Error(BLOCKAID_ERROR_MESSAGES.BULK_TOKEN_SCAN_FAILED);
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

    analytics.track(AnalyticsEvent.BLOCKAID_SITE_SCAN, {
      url,
      network,
    });

    return scanResult;
  } catch (error) {
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

    analytics.track(AnalyticsEvent.BLOCKAID_TRANSACTION_SCAN, {
      xdr,
      url,
      network,
    });

    return scanResult;
  } catch (error) {
    throw new Error(BLOCKAID_ERROR_MESSAGES.TRANSACTION_SCAN_FAILED);
  }
};
