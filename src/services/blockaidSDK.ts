import BlockaidClient from "@blockaid/client";
import { logger } from "config/logger";
import type {
  ScanSiteParams,
  ScanAssetParams,
  ScanTransactionParams,
  BlockAidScanSiteResult,
  BlockAidScanAssetResult,
  BlockAidScanTxResult,
} from "types/blockaid";

let blockaidClient: BlockaidClient | null = null;

const getBlockaidClient = (): BlockaidClient => {
  if (!blockaidClient) {
    const apiKey = process.env.BLOCKAID_API_KEY;

    if (!apiKey) {
      throw new Error("Blockaid API key not configured");
    }

    blockaidClient = new BlockaidClient({
      apiKey,
    });
  }

  return blockaidClient;
};

export const scanSiteSDK = async (
  params: ScanSiteParams,
): Promise<BlockAidScanSiteResult | null> => {
  try {
    logger.info("blockaidSDK.scanSite", "Starting site scan", {
      url: params.url,
    });

    const client = getBlockaidClient();
    const result = await client.site.scan({
      url: params.url,
    });

    logger.info("blockaidSDK.scanSite", "Scan completed successfully", {
      resultType: (result as { result_type?: string }).result_type,
      status: (result as { status?: string }).status,
    });

    return result as BlockAidScanSiteResult;
  } catch (error) {
    logger.error("blockaidSDK.scanSite", "Error in site scan", error);
    return null;
  }
};

// Uses Stellar format: "SYMBOL-ISSUER" or "XLM-native"
export const scanAssetSDK = async (
  params: ScanAssetParams,
): Promise<BlockAidScanAssetResult | null> => {
  try {
    logger.info("blockaidSDK.scanAsset", "Starting asset scan", {
      assetCode: params.assetCode,
      network: params.network,
    });

    const client = getBlockaidClient();

    // Format asset address for Stellar
    let tokenAddress: string;
    if (params.assetCode === "XLM" || !params.assetIssuer) {
      tokenAddress = "XLM-native";
    } else {
      tokenAddress = `${params.assetCode}-${params.assetIssuer}`;
    }

    const result = await client.token.scan({
      address: tokenAddress,
      chain: "stellar",
    });

    logger.info("blockaidSDK.scanAsset", "Scan completed successfully", {
      tokenAddress,
      resultType: (result as { result_type?: string }).result_type,
    });

    return result as BlockAidScanAssetResult;
  } catch (error) {
    logger.error("blockaidSDK.scanAsset", "Error in asset scan", error);
    return null;
  }
};

// Note: Limited support for Stellar XDR format
export const scanTransactionSDK = async (
  params: ScanTransactionParams,
): Promise<BlockAidScanTxResult | null> => {
  try {
    logger.info("blockaidSDK.scanTransaction", "Starting transaction scan", {
      network: params.network,
      sourceAccount: `${params.sourceAccount.substring(0, 10)}...`,
    });

    const client = getBlockaidClient();
    const result = await client.stellar.transaction.scan({
      transaction: params.xdr,
      account_address: params.sourceAccount,
      chain: params.network.toLowerCase() === "public" ? "pubnet" : "testnet",
      metadata: {},
    });

    logger.info("blockaidSDK.scanTransaction", "Scan completed successfully");
    return result as BlockAidScanTxResult;
  } catch (error) {
    logger.warn(
      "blockaidSDK.scanTransaction",
      "Transaction scan not supported",
      {
        error: error instanceof Error ? error.message : String(error),
        status: (error as { status?: string })?.status || "unknown",
      },
    );

    // Return null to allow backend fallback
    return null;
  }
};

// Check if Blockaid SDK is available (API key configured)
export const isBlockaidSDKAvailable = (): boolean =>
  Boolean(process.env.BLOCKAID_API_KEY);
