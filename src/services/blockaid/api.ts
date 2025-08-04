import Blockaid from "@blockaid/client";
import { AnalyticsEvent } from "config/analyticsConfig";
import { isMainnet } from "helpers/networks";
import { analytics } from "services/analytics";
import { freighterBackend } from "services/backend";
import {
  BLOCKAID_ENDPOINTS,
  BLOCKAID_ERROR_MESSAGES,
} from "services/blockaid/constants";
import {
  BlockaidApiResponse,
  ScanAssetParams,
  ScanSiteParams,
  ScanTransactionParams,
} from "services/blockaid/types";

const formatAddress = (assetCode: string, assetIssuer?: string): string => {
  if (assetIssuer) {
    return `${assetCode}-${assetIssuer}`;
  }

  return assetCode;
};

export const scanAsset = async (
  params: ScanAssetParams,
): Promise<Blockaid.TokenScanResponse> => {
  const { assetCode, assetIssuer, network } = params;

  try {
    if (!isMainnet(network)) {
      throw new Error(BLOCKAID_ERROR_MESSAGES.NETWORK_NOT_SUPPORTED);
    }

    const address = formatAddress(assetCode, assetIssuer);

    const response = await freighterBackend.get<
      BlockaidApiResponse<Blockaid.TokenScanResponse>
    >(`${BLOCKAID_ENDPOINTS.SCAN_ASSET}?address=${address}`);

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    const scanResult = response.data.data as Blockaid.TokenScanResponse;

    analytics.track(AnalyticsEvent.BLOCKAID_ASSET_SCAN, {
      response: scanResult,
      assetCode,
      network,
    });

    return scanResult;
  } catch (error) {
    throw new Error(BLOCKAID_ERROR_MESSAGES.ASSET_SCAN_FAILED);
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

    const response = await freighterBackend.get<
      BlockaidApiResponse<Blockaid.SiteScanResponse>
    >(`${BLOCKAID_ENDPOINTS.SCAN_SITE}?url=${url}`);

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    const scanResult = response.data.data as Blockaid.SiteScanResponse;

    analytics.track(AnalyticsEvent.BLOCKAID_SITE_SCAN, {
      response: scanResult,
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
      url: encodeURIComponent(url),
      tx_xdr: xdr,
      network,
    };

    const response = await freighterBackend.post<
      BlockaidApiResponse<Blockaid.StellarTransactionScanResponse>
    >(BLOCKAID_ENDPOINTS.SCAN_TRANSACTION, transactionParams);

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    const scanResult = response.data
      .data as Blockaid.StellarTransactionScanResponse;

    analytics.track(AnalyticsEvent.BLOCKAID_TRANSACTION_SCAN, {
      response: scanResult,
      xdr,
      url,
      network,
    });

    return scanResult;
  } catch (error) {
    throw new Error(BLOCKAID_ERROR_MESSAGES.TRANSACTION_SCAN_FAILED);
  }
};
