import {
  Asset,
  Contract,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  Address,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { AxiosError } from "axios";
import { BigNumber } from "bignumber.js";
import {
  DEFAULT_DECIMALS,
  NATIVE_TOKEN_CODE,
  NETWORKS,
  NetworkDetails,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import { Balance, NativeBalance, PricedBalance } from "config/types";
import { isLiquidityPool } from "helpers/balances";
import { xlmToStroop } from "helpers/formatAmount";
import { isContractId, getNativeContractDetails } from "helpers/soroban";
import { isValidStellarAddress, isSameAccount } from "helpers/stellar";
import { t } from "i18next";
import { analytics } from "services/analytics";
import { simulateTokenTransfer } from "services/backend";
import { stellarSdkServer } from "services/stellar";

export interface BuildPaymentTransactionParams {
  tokenAmount: string;
  selectedBalance?: PricedBalance;
  recipientAddress?: string;
  transactionMemo?: string;
  transactionFee?: string;
  transactionTimeout?: number;
  network?: NETWORKS;
  senderAddress?: string;
}

export interface BuildSwapTransactionParams {
  sourceAmount: string;
  sourceBalance: PricedBalance;
  destinationBalance: PricedBalance;
  path: string[];
  destinationAmount: string;
  destinationAmountMin: string;
  transactionFee?: string;
  transactionTimeout?: number;
  network?: NETWORKS;
  senderAddress?: string;
}

export const isNativeBalance = (balance: Balance): balance is NativeBalance =>
  "token" in balance &&
  balance.token &&
  "type" in balance.token &&
  balance.token.type === "native";

interface IValidateTransactionParams {
  senderAddress: string;
  balance: PricedBalance;
  amount: string;
  destination: string;
  fee: string;
  timeout: number;
}

/**
 * Validates all transaction parameters
 * Returns an error message if any validation fails
 */
export const validateTransactionParams = (
  params: IValidateTransactionParams,
): string | null => {
  const { senderAddress, balance, amount, destination, fee, timeout } = params;
  // Validate amount is positive
  if (Number(amount) <= 0) {
    return t("transaction.errors.amountRequired");
  }

  // Validate fee is positive
  if (Number(fee) <= 0) {
    return t("transaction.errors.feeRequired");
  }

  // Validate timeout
  if (timeout <= 0) {
    return t("transaction.errors.timeoutRequired");
  }

  // Check if the recipient address is valid
  if (!isValidStellarAddress(destination)) {
    return t("transaction.errors.invalidRecipientAddress");
  }

  // Prevent sending to self
  if (isSameAccount(senderAddress, destination)) {
    return t("transaction.errors.cannotSendToSelf");
  }

  // Validate sufficient balance
  const transactionAmount = new BigNumber(amount);
  const balanceAmount = new BigNumber(balance.total);

  if (transactionAmount.isGreaterThan(balanceAmount)) {
    return t("transaction.errors.insufficientBalance");
  }

  return null;
};

/**
 * Validates swap transaction parameters
 * Returns an error message if any validation fails
 */
export const validateSwapTransactionParams = (params: {
  sourceBalance: PricedBalance;
  destinationBalance: PricedBalance;
  sourceAmount: string;
  destinationAmount: string;
  fee: string;
  timeout: number;
}): string | null => {
  const {
    sourceBalance,
    destinationBalance,
    sourceAmount,
    destinationAmount,
    fee,
    timeout,
  } = params;

  // Validate amount is positive
  if (Number(sourceAmount) <= 0) {
    return t("transaction.errors.amountRequired");
  }

  // Validate destination amount is positive
  if (Number(destinationAmount) <= 0) {
    return t("transaction.errors.destinationAmountRequired");
  }

  // Validate fee is positive
  if (Number(fee) <= 0) {
    return t("transaction.errors.feeRequired");
  }

  // Validate timeout
  if (timeout <= 0) {
    return t("transaction.errors.timeoutRequired");
  }

  // Validate sufficient balance
  const transactionAmount = new BigNumber(sourceAmount);
  const balanceAmount = new BigNumber(sourceBalance.total);

  if (transactionAmount.isGreaterThan(balanceAmount)) {
    return t("transaction.errors.insufficientBalanceForSwap");
  }

  // Validate different assets
  if (sourceBalance.id === destinationBalance.id) {
    return t("transaction.errors.cannotSwapSameAsset");
  }

  return null;
};

/**
 * Gets the appropriate asset for payment
 */
export const getAssetForPayment = (balance: PricedBalance): Asset => {
  // For native XLM tokens
  if (balance.tokenCode === NATIVE_TOKEN_CODE || isNativeBalance(balance)) {
    return Asset.native();
  }

  // For non-native tokens and non-liquidity pools
  if (!isLiquidityPool(balance) && "token" in balance && balance.token) {
    if (
      "type" in balance.token &&
      typeof balance.token.type === "string" &&
      (balance.token.type as string) !== "native" &&
      "code" in balance.token &&
      "issuer" in balance.token &&
      balance.token.issuer &&
      "key" in balance.token.issuer
    ) {
      return new Asset(balance.token.code, balance.token.issuer.key);
    }
  }

  throw new Error("Unsupported asset type for payment");
};

/**
 * Returns the native token contract ID for a given network
 */
export const getContractIdForNativeToken = (network: NETWORKS): string => {
  const nativeContractDetails = getNativeContractDetails(network);
  if (!nativeContractDetails.contract) {
    throw new Error(
      `No native token contract available for network: ${network}`,
    );
  }
  return nativeContractDetails.contract;
};

interface IBuildSorobanTransferOperation {
  sourceAccount: string;
  destinationAddress: string;
  amount: string;
  asset: Asset;
  transactionBuilder: TransactionBuilder;
  network: NETWORKS;
}

/**
 * Builds a Soroban token transfer operation for sending to contract addresses
 */
export const buildSorobanTransferOperation = (
  params: IBuildSorobanTransferOperation,
): TransactionBuilder => {
  const {
    sourceAccount,
    destinationAddress,
    amount,
    asset,
    transactionBuilder,
    network,
  } = params;

  try {
    const contractId = asset.isNative()
      ? getContractIdForNativeToken(network)
      : destinationAddress;

    const contract = new Contract(contractId);

    const transaction = contract.call(
      "transfer",
      new Address(sourceAccount).toScVal(),
      new Address(destinationAddress).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    );

    transactionBuilder.addOperation(transaction);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      "TransactionService",
      "Error building Soroban transfer operation",
      {
        error: errorMessage,
      },
    );
    throw new Error(
      `Error building Soroban transfer operation: ${errorMessage}`,
    );
  }

  return transactionBuilder;
};

interface BuildPaymentTransactionResult {
  tx: Transaction;
  xdr: string;
  contractId?: string;
}

/**
 * Builds a payment transaction (standard or Soroban)
 */
export const buildPaymentTransaction = async (
  params: BuildPaymentTransactionParams,
): Promise<BuildPaymentTransactionResult> => {
  const {
    tokenAmount: amount,
    selectedBalance,
    recipientAddress,
    transactionMemo: memo,
    transactionFee,
    transactionTimeout,
    network,
    senderAddress,
  } = params;
  try {
    if (
      !senderAddress ||
      !network ||
      !selectedBalance ||
      !recipientAddress ||
      !transactionFee ||
      !transactionTimeout
    ) {
      throw new Error("Missing required parameters for building transaction");
    }

    const validationError = validateTransactionParams({
      senderAddress,
      balance: selectedBalance,
      amount,
      destination: recipientAddress,
      fee: transactionFee,
      timeout: transactionTimeout,
    });

    if (validationError) {
      throw new Error(validationError);
    }
    const networkDetails = mapNetworkToNetworkDetails(network);
    const server = stellarSdkServer(networkDetails.networkUrl);
    const sourceAccount = await server.loadAccount(senderAddress);
    const fee = xlmToStroop(transactionFee).toString();

    const transactionBuilder = new TransactionBuilder(sourceAccount, {
      fee,
      timebounds: await server.fetchTimebounds(transactionTimeout),
      networkPassphrase: networkDetails.networkPassphrase,
    });

    if (memo) {
      transactionBuilder.addMemo(new Memo(Memo.text(memo).type, memo));
    }

    const isToContractAddress = isContractId(recipientAddress);

    if (isToContractAddress) {
      const asset = getAssetForPayment(selectedBalance);
      const contractId = asset.isNative()
        ? getContractIdForNativeToken(network)
        : recipientAddress;

      const decimals =
        "decimals" in selectedBalance
          ? selectedBalance.decimals
          : DEFAULT_DECIMALS;
      const amountInBaseUnits = BigNumber(amount)
        .shiftedBy(decimals)
        .toFixed(0);

      buildSorobanTransferOperation({
        sourceAccount: senderAddress,
        destinationAddress: recipientAddress,
        amount: amountInBaseUnits,
        asset,
        transactionBuilder,
        network,
      });

      const transaction = transactionBuilder.build();

      return { tx: transaction, xdr: transaction.toXDR(), contractId };
    }

    const asset = getAssetForPayment(selectedBalance);

    // Check if destination is funded, but only for XLM transfers
    if (asset.isNative()) {
      try {
        await server.loadAccount(recipientAddress);
      } catch (e) {
        const error = e as AxiosError;

        if (error.response && error.response.status === 404) {
          // Ensure the amount is sufficient for account creation
          if (BigNumber(amount).isLessThan(1)) {
            throw new Error(t("transaction.errors.minimumXlmForNewAccount"));
          }

          transactionBuilder.addOperation(
            Operation.createAccount({
              destination: recipientAddress,
              startingBalance: amount,
            }),
          );

          const transaction = transactionBuilder.build();

          return { tx: transaction, xdr: transaction.toXDR() };
        }

        throw error;
      }
    }

    // If account is funded or asset is not XLM, use standard payment
    transactionBuilder.addOperation(
      Operation.payment({
        destination: recipientAddress,
        asset,
        amount,
      }),
    );

    const transaction = transactionBuilder.build();
    return { tx: transaction, xdr: transaction.toXDR() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("TransactionService", "Failed to build payment transaction", {
      error: errorMessage,
    });
    throw new Error(`Failed to build payment transaction: ${errorMessage}`);
  }
};

/**
 * Builds a swap transaction (path payment)
 */
export const buildSwapTransaction = async (
  params: BuildSwapTransactionParams,
): Promise<BuildPaymentTransactionResult> => {
  const {
    sourceAmount,
    sourceBalance,
    destinationBalance,
    path,
    destinationAmount,
    destinationAmountMin,
    transactionFee,
    transactionTimeout,
    network,
    senderAddress,
  } = params;

  try {
    if (!senderAddress || !network || !transactionFee || !transactionTimeout) {
      throw new Error("Missing required parameters for building transaction");
    }

    const validationError = validateSwapTransactionParams({
      sourceBalance,
      destinationBalance,
      sourceAmount,
      destinationAmount,
      fee: transactionFee,
      timeout: transactionTimeout,
    });

    if (validationError) {
      throw new Error(validationError);
    }

    const networkDetails = mapNetworkToNetworkDetails(network);
    const server = stellarSdkServer(networkDetails.networkUrl);
    const sourceAccount = await server.loadAccount(senderAddress);
    const fee = xlmToStroop(transactionFee).toString();

    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee,
      timebounds: await server.fetchTimebounds(transactionTimeout),
      networkPassphrase: networkDetails.networkPassphrase,
    });

    const sourceAsset = getAssetForPayment(sourceBalance);
    const destAsset = getAssetForPayment(destinationBalance);
    const pathAssets = path.map((pathItem) => {
      if (pathItem === "native") {
        return Asset.native();
      }

      const [code, issuer] = pathItem.split(":");

      return new Asset(code, issuer);
    });

    txBuilder.addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: sourceAsset,
        sendAmount: sourceAmount,
        destination: senderAddress,
        destAsset,
        destMin: destinationAmountMin,
        path: pathAssets,
      }),
    );

    const transaction = txBuilder.build();
    return { tx: transaction, xdr: transaction.toXDR() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("TransactionService", "Failed to build swap transaction", {
      error: errorMessage,
    });
    throw new Error(`Failed to build swap transaction: ${errorMessage}`);
  }
};

interface SimulateContractTransferParams {
  transaction: Transaction;
  networkDetails: NetworkDetails;
  memo: string;
  params: {
    publicKey: string;
    destination: string;
    amount: string;
  };
  contractAddress: string;
}

export const simulateContractTransfer = async ({
  transaction,
  networkDetails,
  memo,
  params,
  contractAddress,
}: SimulateContractTransferParams) => {
  if (!transaction.source) {
    throw new Error("Transaction source is not defined");
  }

  if (!networkDetails.sorobanRpcUrl) {
    throw new Error("Soroban RPC URL is not defined for this network");
  }

  try {
    const result = await simulateTokenTransfer({
      address: contractAddress,
      pub_key: transaction.source,
      memo,
      params,
      network_url: networkDetails.sorobanRpcUrl,
      network_passphrase: networkDetails.networkPassphrase,
    });
    return result.preparedTx.toXDR();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    analytics.trackSimulationError(errorMessage, "contract_transfer");

    throw error;
  }
};
