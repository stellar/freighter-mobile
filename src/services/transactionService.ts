import {
  Asset,
  Contract,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
  nativeToScVal,
  Address,
  TimeoutInfinite,
} from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import {
  NATIVE_TOKEN_CODE,
  NETWORKS,
  NetworkDetails,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import {
  Balance,
  NativeBalance,
  LiquidityPoolBalance,
  PricedBalance,
} from "config/types";
import { xlmToStroop } from "helpers/formatAmount";
import { isContractId, getNativeContractDetails } from "helpers/soroban";
import { isValidStellarAddress, isSameAccount } from "helpers/stellar";
import { getSorobanRpcServer, stellarSdkServer } from "services/stellar";

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
  tokenAmount: string;
  fromBalance: PricedBalance;
  toBalance: PricedBalance;
  path: string[];
  destinationAmount: string;
  destinationAmountMin: string;
  transactionFee?: string;
  transactionTimeout?: number;
  network?: NETWORKS;
  senderAddress?: string;
}

// Type guards for Balance types
export const isLiquidityPool = (
  balance: Balance,
): balance is LiquidityPoolBalance =>
  "liquidityPoolId" in balance && "reserves" in balance;

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
    return "Amount must be greater than 0";
  }

  // Validate fee is positive
  if (Number(fee) <= 0) {
    return "Fee must be greater than 0";
  }

  // Validate timeout
  if (timeout <= 0) {
    return "Timeout must be greater than 0";
  }

  // Check if the recipient address is valid
  if (!isValidStellarAddress(destination)) {
    return "Invalid recipient address";
  }

  // Prevent sending to self
  if (isSameAccount(senderAddress, destination)) {
    return "Cannot send to yourself";
  }

  // Validate sufficient balance
  const transactionAmount = new BigNumber(amount);
  const balanceAmount = new BigNumber(balance.total);

  if (transactionAmount.isGreaterThan(balanceAmount)) {
    return "Insufficient balance";
  }

  return null;
};

/**
 * Validates swap transaction parameters
 * Returns an error message if any validation fails
 */
export const validateSwapTransactionParams = (params: {
  fromBalance: PricedBalance;
  toBalance: PricedBalance;
  amount: string;
  destinationAmount: string;
  fee: string;
  timeout: number;
}): string | null => {
  const { fromBalance, toBalance, amount, destinationAmount, fee, timeout } =
    params;

  // Validate amount is positive
  if (Number(amount) <= 0) {
    return "Amount must be greater than 0";
  }

  // Validate destination amount is positive
  if (Number(destinationAmount) <= 0) {
    return "Destination amount must be greater than 0";
  }

  // Validate fee is positive
  if (Number(fee) <= 0) {
    return "Fee must be greater than 0";
  }

  // Validate timeout
  if (timeout <= 0) {
    return "Timeout must be greater than 0";
  }

  // Validate sufficient balance
  const transactionAmount = new BigNumber(amount);
  const balanceAmount = new BigNumber(fromBalance.total);

  if (transactionAmount.isGreaterThan(balanceAmount)) {
    return "Insufficient balance for swap";
  }

  // Validate different assets
  if (fromBalance.id === toBalance.id) {
    return "Cannot swap to the same asset";
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
  txBuilder: TransactionBuilder;
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
    txBuilder,
    network,
  } = params;
  try {
    // For native XLM tokens, use the native token contract
    // For other tokens, use the destination as the contract (this might need adjustment based on your use case)
    const contractId = asset.isNative()
      ? getContractIdForNativeToken(network)
      : destinationAddress;

    // Create a contract instance for the appropriate contract
    const contract = new Contract(contractId);

    if (asset.isNative()) {
      // Convert the amount to stroops (1 XLM = 10,000,000 stroops)
      const amountInStroops = xlmToStroop(amount).toString();

      // Create parameters for the transfer
      const fromParam = new Address(sourceAccount).toScVal();
      const toParam = new Address(destinationAddress).toScVal();
      const amountParam = new BigNumber(amountInStroops).isInteger()
        ? xdr.ScVal.scvI128(
            new xdr.Int128Parts({
              lo: xdr.Uint64.fromString(amountInStroops),
              hi: xdr.Int64.fromString("0"),
            }),
          )
        : xdr.ScVal.scvI128(
            new xdr.Int128Parts({
              lo: xdr.Uint64.fromString("0"),
              hi: xdr.Int64.fromString("0"),
            }),
          );

      // Add the operation to the transaction builder and return the updated builder
      txBuilder.addOperation(
        contract.call("transfer", fromParam, toParam, amountParam),
      );

      // Set the timeout to infinite for Soroban transactions
      txBuilder.setTimeout(TimeoutInfinite);

      return txBuilder;
    }

    // For non-native assets, use a similar approach
    const fromParam = new Address(sourceAccount).toScVal();
    const toParam = new Address(destinationAddress).toScVal();
    const amountParam = nativeToScVal(amount);

    // Add the operation to the transaction builder and return the updated builder
    txBuilder.addOperation(
      contract.call("transfer", fromParam, toParam, amountParam),
    );

    // Set the timeout to infinite for Soroban transactions
    txBuilder.setTimeout(TimeoutInfinite);

    return txBuilder;
  } catch (error) {
    logger.error("TransactionBuilder", "Failed to create Soroban operation", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `Unable to create contract operation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

interface SorobanRpcServerWithPrepare {
  prepareTransaction: (tx: Transaction) => Promise<unknown>;
}

interface IPrepareSorobanTransaction {
  tx: Transaction;
  networkDetails: NetworkDetails;
}

/**
 * Helper function to prepare a Soroban transaction with RPC simulation
 */
export const prepareSorobanTransaction = async (
  params: IPrepareSorobanTransaction,
): Promise<string> => {
  const { tx, networkDetails } = params;
  try {
    const sorobanRpc = getSorobanRpcServer(networkDetails.network);
    if (!sorobanRpc) {
      logger.warn(
        "TransactionBuilder",
        "Soroban RPC server not available, using standard transaction",
      );

      // Return the standard transaction XDR string if RPC is not available
      return tx.toXDR();
    }

    try {
      if (
        typeof sorobanRpc !== "object" ||
        typeof (sorobanRpc as SorobanRpcServerWithPrepare)
          .prepareTransaction !== "function"
      ) {
        return tx.toXDR();
      }

      // The SDK's prepareTransaction is expected to return the prepared Transaction object
      const preparedTx: unknown = await (
        sorobanRpc as SorobanRpcServerWithPrepare
      ).prepareTransaction(tx);

      if (preparedTx instanceof Transaction) {
        // Return the XDR of the PREPARED transaction
        return preparedTx.toXDR();
      }

      // Return the original XDR only if preparation failed unexpectedly
      return tx.toXDR();
    } catch (prepError) {
      const errorMessage =
        prepError instanceof Error ? prepError.message : String(prepError);
      logger.error("TransactionBuilder", "Error during prepareTransaction", {
        error: errorMessage,
      });

      throw new Error(`Error during prepareTransaction: ${errorMessage}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      "TransactionBuilder",
      "Error during Soroban transaction preparation",
      { error: errorMessage },
    );

    throw new Error(
      `Error during Soroban transaction preparation: ${errorMessage}`,
    );
  }
};

interface BuildPaymentTransactionResult {
  tx: Transaction;
  xdr: string;
}

/**
 * Builds a payment transaction
 * @param params Object containing tokenAmount (required) and optional overrides
 * @returns The transaction XDR string or throws an error with details
 */
export const buildPaymentTransaction = async (
  params: BuildPaymentTransactionParams,
): Promise<BuildPaymentTransactionResult> => {
  const {
    tokenAmount: amount,
    selectedBalance: balance,
    recipientAddress: destination,
    transactionMemo: memo,
    transactionFee: fee,
    transactionTimeout: timeout,
    network: currentNetwork,
    senderAddress,
  } = params;

  if (!senderAddress) {
    throw new Error("Public key is required");
  }

  if (!destination) {
    throw new Error("Recipient address is required");
  }

  if (!balance) {
    throw new Error("Selected balance not found");
  }

  if (!fee) {
    throw new Error("Transaction fee is required");
  }

  if (!timeout) {
    throw new Error("Transaction timeout is required");
  }

  if (!currentNetwork) {
    throw new Error("Network is required");
  }

  try {
    const validationError = validateTransactionParams({
      senderAddress,
      balance,
      amount,
      destination,
      fee,
      timeout,
    });

    if (validationError) {
      throw new Error(validationError);
    }

    const networkDetails = mapNetworkToNetworkDetails(currentNetwork);
    const server = stellarSdkServer(networkDetails.networkUrl);

    // Load the source account
    const sourceAccount = await server.loadAccount(senderAddress);

    // Create transaction builder with validated parameters
    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee: xlmToStroop(fee).toFixed(),
      networkPassphrase: networkDetails.networkPassphrase,
    });

    // Check if we're sending to a contract address
    const isToContractAddress = isContractId(destination);

    // Get the asset object
    const asset = getAssetForPayment(balance);

    // Add the appropriate operation based on the destination type
    if (isToContractAddress) {
      // For contract addresses, use Soroban operations
      buildSorobanTransferOperation({
        sourceAccount: senderAddress,
        destinationAddress: destination,
        amount,
        asset,
        txBuilder,
        network: currentNetwork,
      });
    } else {
      // Determine if destination account exists (for XLM sends)
      const isNativeAsset =
        balance.tokenCode === NATIVE_TOKEN_CODE || isNativeBalance(balance);
      let isDestinationFunded = true;

      if (isNativeAsset) {
        try {
          await server.loadAccount(destination);
        } catch (e) {
          isDestinationFunded = false;

          // Validate minimum starting balance for account creation (1 XLM)
          if (new BigNumber(amount).isLessThan(1)) {
            throw new Error(
              "Minimum of 1 XLM required to create a new account",
            );
          }
        }
      }

      // Add the appropriate operation based on destination and asset type
      if (isNativeAsset && !isDestinationFunded) {
        // Create account operation for new accounts receiving XLM
        txBuilder.addOperation(
          Operation.createAccount({
            destination,
            startingBalance: amount,
          }),
        );
      } else {
        // Regular payment operation
        txBuilder.addOperation(
          Operation.payment({
            destination,
            asset,
            amount,
          }),
        );
      }

      // Set the timeout for regular transactions
      txBuilder.setTimeout(timeout);
    }

    // Add memo if provided
    if (memo) {
      txBuilder.addMemo(Memo.text(memo));
    }

    // Build the transaction
    const transaction = txBuilder.build();

    if (isToContractAddress) {
      const preparedXdr = await prepareSorobanTransaction({
        tx: transaction,
        networkDetails,
      });

      // Return the original transaction object and the prepared XDR
      return { tx: transaction, xdr: preparedXdr };
    }

    // For regular transactions, just return the transaction object and its XDR
    return { tx: transaction, xdr: transaction.toXDR() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("TransactionService", "Failed to build transaction", {
      error: errorMessage,
    });

    throw new Error(`Failed to build transaction: ${errorMessage}`);
  }
};

/**
 * Builds a swap transaction using pathPaymentStrictSend operation
 * This handles classic asset swaps via Stellar's built-in DEX
 */
export const buildSwapTransaction = async (
  params: BuildSwapTransactionParams,
): Promise<BuildPaymentTransactionResult> => {
  const {
    tokenAmount: amount,
    fromBalance,
    toBalance,
    path,
    destinationAmount,
    destinationAmountMin,
    transactionFee: fee,
    transactionTimeout: timeout,
    network: currentNetwork,
    senderAddress,
  } = params;

  if (!senderAddress) {
    throw new Error("Public key is required");
  }

  if (!fromBalance) {
    throw new Error("Source balance not found");
  }

  if (!toBalance) {
    throw new Error("Destination balance not found");
  }

  if (!fee) {
    throw new Error("Transaction fee is required");
  }

  if (!timeout) {
    throw new Error("Transaction timeout is required");
  }

  if (!currentNetwork) {
    throw new Error("Network is required");
  }

  try {
    const validationError = validateSwapTransactionParams({
      fromBalance,
      toBalance,
      amount,
      destinationAmount,
      fee,
      timeout,
    });

    if (validationError) {
      throw new Error(validationError);
    }

    const networkDetails = mapNetworkToNetworkDetails(currentNetwork);
    const server = stellarSdkServer(networkDetails.networkUrl);

    // Load the source account
    const sourceAccount = await server.loadAccount(senderAddress);

    // Create transaction builder with validated parameters
    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee: xlmToStroop(fee).toFixed(),
      networkPassphrase: networkDetails.networkPassphrase,
    });

    // Get the asset objects
    const sourceAsset = getAssetForPayment(fromBalance);
    const destAsset = getAssetForPayment(toBalance);

    // Convert path strings to Asset objects
    const pathAssets: Asset[] = path.map((pathItem) => {
      if (pathItem === "native") {
        return Asset.native();
      }
      const [code, issuer] = pathItem.split(":");
      return new Asset(code, issuer);
    });

    // Build pathPaymentStrictSend operation
    // For swaps, the destination is always the sender's own address
    const swapOperation = Operation.pathPaymentStrictSend({
      sendAsset: sourceAsset,
      sendAmount: amount,
      destination: senderAddress, // Key difference: send to self for swaps
      destAsset,
      destMin: destinationAmountMin,
      path: pathAssets,
    });

    txBuilder.addOperation(swapOperation);
    txBuilder.setTimeout(timeout);

    // Build the transaction
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
