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
  tokenValue: string;
  selectedBalance?: PricedBalance;
  recipientAddress?: string;
  transactionMemo?: string;
  transactionFee?: string;
  transactionTimeout?: number;
  network?: NETWORKS;
  publicKey?: string;
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

/**
 * Validates all transaction parameters
 * Returns an error message if any validation fails
 */
export const validateTransactionParams = (
  publicKey: string,
  balance: PricedBalance,
  amount: string,
  destination: string,
  fee: string,
  timeout: number,
): string | null => {
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
  if (isSameAccount(publicKey, destination)) {
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

/**
 * Builds a Soroban token transfer operation for sending to contract addresses
 */
export const buildSorobanTransferOperation = (
  sourceAccount: string,
  destinationAddress: string,
  amount: string,
  asset: Asset,
  txBuilder: TransactionBuilder,
  network: NETWORKS,
): TransactionBuilder => {
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

/**
 * Helper function to prepare a Soroban transaction with RPC simulation
 */
export const prepareSorobanTransaction = async (
  tx: Transaction,
  networkDetails: NetworkDetails,
): Promise<string> => {
  try {
    const sorobanRpc = getSorobanRpcServer(networkDetails.network);
    if (!sorobanRpc) {
      logger.warn(
        "TransactionBuilder",
        "Soroban RPC server not available, using standard transaction",
      );
      return tx.toXDR();
    }

    // Convert transaction to XDR before passing to prepareTransaction
    const txXdr = tx.toXDR();

    try {
      // The Soroban RPC API's prepareTransaction method requires a transaction XDR string
      // and returns a new transaction XDR that includes the proper Soroban resources
      logger.debug("TransactionBuilder", "Preparing Soroban transaction");

      // Create a strongly typed wrapper for the response to avoid 'any' usage
      interface PrepareTransactionResponse {
        status: string;
        preparedTransactionXdr?: string;
        errorResultXdr?: string;
      }

      // Check if prepareTransaction method exists on the sorobanRpc object
      if (
        typeof sorobanRpc !== "object" ||
        sorobanRpc === null ||
        !("prepareTransaction" in sorobanRpc)
      ) {
        logger.warn(
          "TransactionBuilder",
          "prepareTransaction method not available on server",
        );
        return tx.toXDR();
      }

      // Call the prepareTransaction method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const prepareResponse: unknown = await (
        sorobanRpc as any
      ).prepareTransaction(txXdr);

      // Cast the response to our interface to work with it safely
      const prepareResult = prepareResponse as PrepareTransactionResponse;

      if (
        prepareResult &&
        prepareResult.status === "SUCCESS" &&
        prepareResult.preparedTransactionXdr
      ) {
        logger.info(
          "TransactionBuilder",
          "Soroban transaction prepared successfully",
        );
        return prepareResult.preparedTransactionXdr;
      }

      // If there's an error result, log it
      if (prepareResult && prepareResult.errorResultXdr) {
        logger.warn(
          "TransactionBuilder",
          `Preparation error: ${prepareResult.errorResultXdr}`,
        );
      } else {
        logger.warn(
          "TransactionBuilder",
          "Unexpected response from prepareTransaction",
          // We need to safely log the response since it might not match our expected structure
          typeof prepareResponse === "object" && prepareResponse
            ? prepareResponse
            : "Invalid response",
        );
      }

      // Return the original XDR if preparation failed
      return tx.toXDR();
    } catch (prepError) {
      logger.error("TransactionBuilder", "Error during prepareTransaction", {
        error:
          prepError instanceof Error ? prepError.message : String(prepError),
      });
      return tx.toXDR();
    }
  } catch (error) {
    logger.error(
      "TransactionBuilder",
      "Error during Soroban transaction preparation",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return tx.toXDR();
  }
};

/**
 * Builds a payment transaction XDR string
 * @param params Object containing tokenValue (required) and optional overrides
 * @returns The transaction XDR string or throws an error with details
 */
export const buildPaymentTransaction = async (
  params: BuildPaymentTransactionParams,
): Promise<string> => {
  // Destructure parameters
  const {
    tokenValue: amount,
    selectedBalance: balance,
    recipientAddress: destination,
    transactionMemo: memo,
    transactionFee: fee,
    transactionTimeout: timeout,
    network: currentNetwork,
    publicKey,
  } = params;

  // Log detailed parameters for debugging
  logger.debug(
    "TransactionService.buildPaymentTransaction",
    "Building transaction with parameters",
    {
      amount,
      destination,
      isContractDestination: destination ? isContractId(destination) : false,
      publicKey,
      memo: memo || "(none)",
      fee,
      timeout,
      network: currentNetwork,
      balanceCode: balance?.tokenCode,
    },
  );

  // Validate required parameters
  if (!publicKey) {
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
    // Log the destination address type for debugging
    logger.debug(
      "TransactionService",
      `Building transaction for destination: ${destination}`,
      {
        isContractAddress: isContractId(destination),
      },
    );

    // Validate parameters
    const validationError = validateTransactionParams(
      publicKey,
      balance,
      amount,
      destination,
      fee,
      timeout,
    );

    if (validationError) {
      logger.warn(
        "TransactionService.buildPaymentTransaction",
        "Transaction validation failed",
        {
          validationError,
          destination,
          isContractDestination: isContractId(destination),
        },
      );

      throw new Error(validationError);
    }

    const networkDetails = mapNetworkToNetworkDetails(currentNetwork);
    const server = stellarSdkServer(networkDetails.networkUrl);

    // Load the source account
    const sourceAccount = await server.loadAccount(publicKey);

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
      buildSorobanTransferOperation(
        publicKey,
        destination,
        amount,
        asset,
        txBuilder,
        currentNetwork,
      );
    } else {
      // Regular stellar account payments

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
        logger.debug(
          "TransactionService",
          "Added createAccount operation for new account",
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
        logger.debug(
          "TransactionService",
          "Added payment operation for existing account",
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

    // For contract addresses, run prepare transaction to simulate and prepare
    if (isToContractAddress) {
      return await prepareSorobanTransaction(transaction, networkDetails);
    }

    // For regular transactions, just return the XDR
    return transaction.toXDR();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("TransactionService", "Transaction builder error", {
      error: errorMessage,
    });
    throw error;
  }
};
