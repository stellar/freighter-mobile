import {
  Asset as SdkToken,
  FeeBumpTransaction,
  Horizon,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";
import {
  DEFAULT_TRANSACTION_TIMEOUT,
  mapNetworkToNetworkDetails,
  MIN_TRANSACTION_FEE,
  NATIVE_TOKEN_CODE,
  NETWORKS,
  SOROBAN_RPC_URLS,
} from "config/constants";
import { logger } from "config/logger";
import { FeePresets, FeePriority, NetworkCongestion } from "config/types";
import { formatTokenIdentifier } from "helpers/balances";
import { stroopToXlm, xlmToStroop } from "helpers/formatAmount";
import { getIsSwap } from "helpers/history";

// Retry configuration for transaction submission
export const SUBMIT_BACKOFF_MAX_ATTEMPTS = 5;
export const BASE_BACKOFF_SEC = 1000; // Base delay in milliseconds

// Ledger capacity usage thresholds (0-1) that map to network congestion levels.
const LEDGER_CAPACITY_MEDIUM_THRESHOLD = 0.5;
const LEDGER_CAPACITY_HIGH_THRESHOLD = 0.75;

interface HorizonError {
  response: {
    status: number;
  };
}

export interface TransactionDetail {
  id: string;
  hash: string;
  createdAt: string;
  successful: boolean;
  memo?: string;
  fee: string;
  swapDetails?: {
    sourceTokenCode: string;
    sourceTokenIssuer: string;
    destinationTokenCode: string;
    destinationTokenIssuer: string;
    sourceTokenType: string;
    destinationTokenType: string;
    sourceAmount: string;
    destinationAmount: string;
  };
}

export type BuildChangeTrustTxParams = {
  network: NETWORKS;
  publicKey: string;
  // composed by tokenCode:tokenIssuer
  tokenIdentifier: string;
  isRemove?: boolean;
};

export type SignTxParams = {
  network: NETWORKS;
  tx: Transaction | FeeBumpTransaction | string;
  secretKey: string;
};

export type SubmitTxParams = {
  network: NETWORKS;
  tx: Transaction | FeeBumpTransaction | string;
};

export const isHorizonError = (val: unknown): val is HorizonError =>
  typeof val === "object" &&
  val !== null &&
  "response" in val &&
  typeof val.response === "object" &&
  val.response !== null &&
  "status" in val.response;

export const getIsAllowHttp = (networkUrl: string) =>
  !networkUrl.includes("https");

/**
 * Calculates the delay for exponential backoff retry logic
 * @param attempt The current attempt number (1-based)
 * @returns The delay in milliseconds
 */
export const calculateBackoffDelay = (attempt: number): number =>
  2 ** (attempt - 1) * BASE_BACKOFF_SEC;

export const stellarSdkServer = (networkUrl: string): Horizon.Server =>
  new Horizon.Server(networkUrl, {
    allowHttp: getIsAllowHttp(networkUrl),
  });

/**
 * Creates a Soroban RPC server instance for the given network
 *
 * @param network The network to get the Soroban RPC server for
 * @returns A Soroban RPC server instance or null if there's an error
 */
export const getSorobanRpcServer = (network: NETWORKS) => {
  const sorobanRpcUrl = SOROBAN_RPC_URLS[network];

  if (!sorobanRpcUrl) {
    logger.error(
      "StellarService",
      "No Soroban RPC URL available for network",
      network,
    );

    return null;
  }

  try {
    return new rpc.Server(sorobanRpcUrl, {
      allowHttp: getIsAllowHttp(sorobanRpcUrl),
    });
  } catch (serverError) {
    // Soroban RPC isn't available on every network/configuration; the
    // null return is checked by callers and the app falls back to
    // non-Soroban code paths. Not actionable as a breadcrumb.
    logger.info("StellarService", "Failed to instantiate Soroban RPC Server", {
      error: String(serverError),
    });
    return null;
  }
};

export const submitTx = async (
  input: SubmitTxParams,
  attempt: number = 1,
): Promise<Horizon.HorizonApi.SubmitTransactionResponse> => {
  const { network, tx } = input;
  const { networkUrl, networkPassphrase } = mapNetworkToNetworkDetails(network);
  const server = stellarSdkServer(networkUrl);

  const transaction =
    typeof tx === "string"
      ? TransactionBuilder.fromXDR(tx, networkPassphrase)
      : tx;

  let submittedTx;

  try {
    submittedTx = await server.submitTransaction(transaction);
  } catch (e: unknown) {
    if (isHorizonError(e) && e.response.status === 504) {
      // in case of 504, retry with exponential backoff up to max attempts
      // https://developers.stellar.org/api/errors/http-status-codes/horizon-specific/timeout
      // https://developers.stellar.org/docs/encyclopedia/error-handling
      if (attempt < SUBMIT_BACKOFF_MAX_ATTEMPTS) {
        const delay = calculateBackoffDelay(attempt); // Exponential backoff: 1s, 2s, 4s, 8s
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), delay);
        });
        return submitTx({ network, tx }, attempt + 1);
      }
    }
    throw e;
  }

  return submittedTx;
};

export const getNetworkFees = async (server: Horizon.Server) => {
  let recommendedFee = "";
  let networkCongestion = "" as NetworkCongestion;
  // Inclusion-fee presets (XLM) for the Low/Med/High priority tiers, derived
  // from the Horizon `max_fee` percentile distribution. Defaults are in XLM
  // (the network minimum) — NOT raw stroops — since every consumer treats these
  // as XLM and converts to stroops at build time.
  let feePresets: FeePresets = {
    [FeePriority.LOW]: MIN_TRANSACTION_FEE,
    [FeePriority.MEDIUM]: MIN_TRANSACTION_FEE,
    [FeePriority.HIGH]: MIN_TRANSACTION_FEE,
  };

  try {
    const { max_fee: maxFee, ledger_capacity_usage: ledgerCapacityUsage } =
      await server.feeStats();
    const ledgerCapacityUsageNum = Number(ledgerCapacityUsage);

    feePresets = {
      [FeePriority.LOW]: stroopToXlm(maxFee.p10).toFixed(),
      [FeePriority.MEDIUM]: stroopToXlm(maxFee.p50).toFixed(),
      [FeePriority.HIGH]: stroopToXlm(maxFee.p90).toFixed(),
    };
    // The recommended (default) fee matches the Medium preset (the median of the
    // max-fee distribution), so the settings sheet opens on the "Med" tier.
    recommendedFee = feePresets[FeePriority.MEDIUM];

    if (
      ledgerCapacityUsageNum > LEDGER_CAPACITY_MEDIUM_THRESHOLD &&
      ledgerCapacityUsageNum <= LEDGER_CAPACITY_HIGH_THRESHOLD
    ) {
      networkCongestion = NetworkCongestion.MEDIUM;
    } else if (ledgerCapacityUsageNum > LEDGER_CAPACITY_HIGH_THRESHOLD) {
      networkCongestion = NetworkCongestion.HIGH;
    } else {
      networkCongestion = NetworkCongestion.LOW;
    }
  } catch (e) {
    // Fall back to the network minimum (XLM); presets stay at their XLM
    // defaults set above.
    recommendedFee = MIN_TRANSACTION_FEE;
    networkCongestion = NetworkCongestion.LOW;
  }

  return { recommendedFee, networkCongestion, feePresets };
};

/** Builds a single `changeTrust` operation for a classic asset. */
export const buildChangeTrustOperation = ({
  tokenCode,
  issuer,
  isRemove = false,
}: {
  tokenCode: string;
  issuer: string;
  isRemove?: boolean;
}) =>
  Operation.changeTrust({
    asset: new SdkToken(tokenCode, issuer),
    // Setting the limit to 0 will remove the trustline.
    ...(isRemove && { limit: "0" }),
  });

export const buildChangeTrustTx = async (input: BuildChangeTrustTxParams) => {
  const { network, publicKey, tokenIdentifier, isRemove = false } = input;
  const { tokenCode, issuer } = formatTokenIdentifier(tokenIdentifier);
  const { networkUrl, networkPassphrase } = mapNetworkToNetworkDetails(network);

  const server = stellarSdkServer(networkUrl);
  const account = await server.loadAccount(publicKey);
  const { recommendedFee } = await getNetworkFees(server);

  const txBuilder = new TransactionBuilder(account, {
    fee: xlmToStroop(recommendedFee).toFixed(),
    networkPassphrase,
  });

  txBuilder
    .addOperation(buildChangeTrustOperation({ tokenCode, issuer, isRemove }))
    .setTimeout(DEFAULT_TRANSACTION_TIMEOUT);

  return txBuilder.build().toXDR();
};

export const signTransaction = (input: SignTxParams): string => {
  const { tx, secretKey, network } = input;
  const { networkPassphrase } = mapNetworkToNetworkDetails(network);
  const transactionXDR = typeof tx === "string" ? tx : tx.toXDR();
  const transaction = TransactionBuilder.fromXDR(
    transactionXDR,
    networkPassphrase,
  );

  const keypair = Keypair.fromSecret(secretKey);
  transaction.sign(keypair);

  return transaction.toXDR();
};

export const getAccount = async (
  publicKey: string,
  network: NETWORKS,
): Promise<Horizon.AccountResponse | null> => {
  const { networkUrl } = mapNetworkToNetworkDetails(network);
  const server = stellarSdkServer(networkUrl);
  try {
    const account = await server.loadAccount(publicKey);
    return account;
  } catch (error) {
    return null;
  }
};

/**
 * Retrieves transaction details from the Horizon API including swap data parsing
 */
export const getTransactionDetails = async (
  transactionHash: string,
  network: NETWORKS,
): Promise<TransactionDetail | null> => {
  if (!transactionHash) {
    return null;
  }

  const { networkUrl } = mapNetworkToNetworkDetails(network);
  const server = stellarSdkServer(networkUrl);

  try {
    const transaction = await server
      .transactions()
      .transaction(transactionHash)
      .call();

    if (!transaction) {
      return null;
    }

    const operations = await server
      .operations()
      .forTransaction(transactionHash)
      .call();

    const swapOperation = operations.records.find((operation) =>
      getIsSwap(operation),
    );

    let swapDetails;
    if (swapOperation) {
      const operation = swapOperation as Horizon.ServerApi.OperationRecord & {
        amount?: string;
        asset_code?: string;
        asset_issuer?: string;
        source_asset_code?: string;
        source_asset_issuer?: string;
        source_amount?: string;
        asset_type?: string;
        source_asset_type?: string;
      };

      swapDetails = {
        sourceTokenIssuer: operation.source_asset_issuer || "",
        destinationTokenIssuer: operation.asset_issuer || "",
        sourceTokenCode: operation.source_asset_code || NATIVE_TOKEN_CODE,
        destinationTokenCode: operation.asset_code || NATIVE_TOKEN_CODE,
        sourceAmount: operation.source_amount || "",
        destinationAmount: operation.amount || "",
        sourceTokenType: operation.source_asset_type || "native",
        destinationTokenType: operation.asset_type || "native",
      };
    }

    return {
      id: transaction.id,
      hash: transaction.hash,
      createdAt: transaction.created_at,
      successful: transaction.successful,
      memo: transaction.memo,
      fee: String(transaction.fee_charged),
      swapDetails,
    };
  } catch (error) {
    logger.error(
      "stellarService.getTransactionDetails",
      "Failed to get transaction details",
      error,
      {
        transactionHash,
        network,
      },
    );
    return null;
  }
};
