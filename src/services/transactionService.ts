import {
  Asset as SdkToken,
  Contract,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  Address,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { AxiosError } from "axios";
import { BigNumber } from "bignumber.js";
import {
  NATIVE_TOKEN_CODE,
  NETWORKS,
  NetworkDetails,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { Balance, NativeBalance, PricedBalance } from "config/types";
import { isLiquidityPool } from "helpers/balances";
import { xlmToStroop } from "helpers/formatAmount";
import {
  determineMuxedDestination,
  checkContractMuxedSupport,
} from "helpers/muxedAddress";
import { isContractId, getNativeContractDetails } from "helpers/soroban";
import {
  isValidStellarAddress,
  isSameAccount,
  isMuxedAccount,
  getBaseAccount,
} from "helpers/stellar";
import { t } from "i18next";
import { analytics } from "services/analytics";
import { simulateTokenTransfer, simulateTransaction } from "services/backend";
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

export interface BuildSendCollectibleParams {
  collectionAddress: string;
  recipientAddress: string;
  transactionMemo?: string;
  transactionFee?: string;
  transactionTimeout?: number;
  tokenId: number;
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

  // Validate different tokens
  if (sourceBalance.id === destinationBalance.id) {
    return t("transaction.errors.cannotSwapSameToken");
  }

  return null;
};

/**
 * Validates send collectible transaction parameters
 * Returns an error message if any validation fails
 */
export const validateSendCollectibleTransactionParams = (params: {
  fee: string;
  timeout: number;
}): string | null => {
  const { fee, timeout } = params;

  // Validate fee is positive
  if (Number(fee) <= 0) {
    return t("transaction.errors.feeRequired");
  }

  // Validate timeout
  if (timeout <= 0) {
    return t("transaction.errors.timeoutRequired");
  }

  return null;
};

/**
 * Gets the appropriate token for payment
 */
export const getTokenForPayment = (balance: PricedBalance): SdkToken => {
  // For native XLM tokens
  if (balance.tokenCode === NATIVE_TOKEN_CODE || isNativeBalance(balance)) {
    return SdkToken.native();
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
      return new SdkToken(balance.token.code, balance.token.issuer.key);
    }
  }

  throw new Error("Unsupported token type for payment");
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
  token: SdkToken;
  transactionBuilder: TransactionBuilder;
  network: NETWORKS;
  memo?: string; // Optional memo for creating muxed address
  contractSupportsMuxed?: boolean; // Whether contract supports muxed addresses
}

/**
 * Builds a Soroban token transfer operation for sending to contract addresses
 * Supports muxed addresses (M... format) for CAP-0067 memo support
 *
 * @param params Transfer operation parameters
 * @returns Final destination address (may be muxed if memo was provided and contract supports it)
 * @note transactionBuilder is mutated in place, so it doesn't need to be returned
 */
export const buildSorobanTransferOperation = (
  params: IBuildSorobanTransferOperation,
): string => {
  const {
    sourceAccount,
    destinationAddress,
    amount,
    token,
    transactionBuilder,
    network,
    memo,
    contractSupportsMuxed = false,
  } = params;

  try {
    const contractId = token.isNative()
      ? getContractIdForNativeToken(network)
      : destinationAddress;

    const contract = new Contract(contractId);

    // Determine final destination at the very last step - right before building the operation
    const finalDestination = determineMuxedDestination({
      recipientAddress: destinationAddress,
      transactionMemo: memo,
      contractSupportsMuxed,
    });

    const transaction = contract.call(
      "transfer",
      new Address(sourceAccount).toScVal(),
      new Address(finalDestination).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    );

    // transactionBuilder is mutated in place
    transactionBuilder.addOperation(transaction);

    return finalDestination;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Error building Soroban transfer operation: ${errorMessage}`,
    );
  }
};

interface BuildPaymentTransactionResult {
  tx: Transaction;
  xdr: string;
  contractId?: string;
  finalDestination?: string;
  amountInBaseUnits?: string;
}

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

    const isCustomToken =
      selectedBalance &&
      "contractId" in selectedBalance &&
      selectedBalance.contractId;

    const isToContractAddress = isContractId(recipientAddress);
    const shouldUseSorobanTransfer = isToContractAddress || isCustomToken;
    const isRecipientMuxed = isMuxedAccount(recipientAddress);
    if (memo && !shouldUseSorobanTransfer && !isRecipientMuxed) {
      transactionBuilder.addMemo(new Memo(Memo.text(memo).type, memo));
    }

    if (shouldUseSorobanTransfer) {
      let contractId: string;
      let token: SdkToken;

      if (isCustomToken && selectedBalance.contractId) {
        contractId = selectedBalance.contractId;
        token = SdkToken.native();
      } else {
        try {
          token = getTokenForPayment(selectedBalance);
          contractId = token.isNative()
            ? getContractIdForNativeToken(network)
            : recipientAddress;
        } catch (error) {
          if (isCustomToken && selectedBalance.contractId) {
            contractId = selectedBalance.contractId;
            token = SdkToken.native();
          } else {
            throw error;
          }
        }
      }

      const contractSupportsMuxed = await checkContractMuxedSupport({
        contractId,
        networkDetails,
      });

      // TEST: Check if amount is already in base units or needs conversion
      // If amount is "1" and we're sending 1 million, it might already be in base units
      // Test by NOT converting to see if that fixes it
      // TODO: After testing, determine if amount needs conversion or is already in base units
      const amountInBaseUnits = amount;

      const finalDestination = buildSorobanTransferOperation({
        sourceAccount: senderAddress,
        destinationAddress: recipientAddress,
        amount: amountInBaseUnits,
        token,
        transactionBuilder,
        network,
        memo,
        contractSupportsMuxed,
      });

      const transaction = transactionBuilder.build();
      const transactionXDR = transaction.toXDR();

      return {
        tx: transaction,
        xdr: transactionXDR,
        contractId,
        finalDestination,
        amountInBaseUnits,
      };
    }

    const token = getTokenForPayment(selectedBalance);
    const paymentDestination = recipientAddress;

    const baseAccount = isMuxedAccount(recipientAddress)
      ? getBaseAccount(recipientAddress) || recipientAddress
      : recipientAddress;

    if (token.isNative()) {
      try {
        await server.loadAccount(baseAccount);
      } catch (e) {
        const error = e as AxiosError;

        if (error.response && error.response.status === 404) {
          if (BigNumber(amount).isLessThan(1)) {
            throw new Error(t("transaction.errors.minimumXlmForNewAccount"));
          }

          transactionBuilder.addOperation(
            Operation.createAccount({
              destination: baseAccount,
              startingBalance: amount,
            }),
          );

          const transaction = transactionBuilder.build();

          return {
            tx: transaction,
            xdr: transaction.toXDR(),
            finalDestination: recipientAddress,
          };
        }

        throw error;
      }
    }

    transactionBuilder.addOperation(
      Operation.payment({
        destination: paymentDestination,
        asset: token,
        amount,
      }),
    );

    const transaction = transactionBuilder.build();

    return {
      tx: transaction,
      xdr: transaction.toXDR(),
      finalDestination: recipientAddress,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new Error(`Failed to build payment transaction: ${errorMessage}`);
  }
};

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

    const sourceToken = getTokenForPayment(sourceBalance);
    const destToken = getTokenForPayment(destinationBalance);
    const pathTokens = path.map((pathItem) => {
      if (pathItem === "native") {
        return SdkToken.native();
      }

      const [code, issuer] = pathItem.split(":");

      return new SdkToken(code, issuer);
    });

    txBuilder.addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: sourceToken,
        sendAmount: sourceAmount,
        destination: senderAddress,
        destAsset: destToken,
        destMin: destinationAmountMin,
        path: pathTokens,
      }),
    );

    const transaction = txBuilder.build();
    return { tx: transaction, xdr: transaction.toXDR() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new Error(`Failed to build swap transaction: ${errorMessage}`);
  }
};

interface BuildSendCollectibleTransactionResult {
  tx: Transaction;
  xdr: string;
  finalDestination?: string;
}

/**
 * Builds a collectible transfer transaction
 */
export const buildSendCollectibleTransaction = async (
  params: BuildSendCollectibleParams,
): Promise<BuildSendCollectibleTransactionResult> => {
  const {
    collectionAddress,
    transactionFee,
    transactionTimeout,
    tokenId,
    network,
    recipientAddress,
    senderAddress,
    transactionMemo,
  } = params;

  try {
    if (!senderAddress || !network || !transactionFee || !transactionTimeout) {
      throw new Error("Missing required parameters for building transaction");
    }

    const validationError = validateSendCollectibleTransactionParams({
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
    const contract = new Contract(collectionAddress);

    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee,
      timebounds: await server.fetchTimebounds(transactionTimeout),
      networkPassphrase: networkDetails.networkPassphrase,
    });

    const contractSupportsMuxed = await checkContractMuxedSupport({
      contractId: collectionAddress,
      networkDetails,
    });

    const finalDestination = determineMuxedDestination({
      recipientAddress,
      transactionMemo,
      contractSupportsMuxed,
    });

    const transferParams = [
      new Address(senderAddress).toScVal(),
      new Address(finalDestination).toScVal(),
      xdr.ScVal.scvU32(tokenId),
    ];

    txBuilder.addOperation(contract.call("transfer", ...transferParams));

    const transaction = txBuilder.build();

    return {
      tx: transaction,
      xdr: transaction.toXDR(),
      finalDestination,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Failed to build send collectible transaction: ${errorMessage}`,
    );
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
    // Note: If destination is already muxed (from buildPaymentTransaction),
    // it will be passed through here. The memo parameter is kept for backward compatibility
    // but for CAP-0067, memo should be embedded in the muxed address.
    const result = await simulateTokenTransfer({
      address: contractAddress,
      pub_key: transaction.source,
      memo, // This may be redundant if destination is muxed, but kept for compatibility
      params,
      network_url: networkDetails.sorobanRpcUrl,
      network_passphrase: networkDetails.networkPassphrase,
    });

    // Use the preparedTransaction XDR directly from the backend
    // The backend builds, simulates, and prepares the transaction
    return result.preparedTransaction;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    analytics.trackSimulationError(errorMessage, "contract_transfer");

    throw error;
  }
};

interface SimulateCollectibleTransferParams {
  transactionXdr: string;
  networkDetails: NetworkDetails;
}

export const simulateCollectibleTransfer = async ({
  transactionXdr,
  networkDetails,
}: SimulateCollectibleTransferParams) => {
  if (!networkDetails.sorobanRpcUrl) {
    throw new Error("Soroban RPC URL is not defined for this network");
  }

  try {
    const result = await simulateTransaction({
      xdr: transactionXdr,
      network_url: networkDetails.sorobanRpcUrl,
      network_passphrase: networkDetails.networkPassphrase,
    });

    return result.preparedTransaction;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    analytics.trackSimulationError(errorMessage, "collectible_transfer");
    throw error;
  }
};
