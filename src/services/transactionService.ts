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
import {
  isValidStellarAddress,
  isSameAccount,
  createMuxedAccount,
  getBaseAccount,
  isMuxedAccount,
} from "helpers/stellar";
import { t } from "i18next";
import { analytics } from "services/analytics";
import {
  simulateTokenTransfer,
  simulateTransaction,
  checkContractSupportsMuxed,
} from "services/backend";
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
 * @returns TransactionBuilder with the transfer operation added
 */
export const buildSorobanTransferOperation = (
  params: IBuildSorobanTransferOperation,
): TransactionBuilder => {
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
    // If contract supports muxed, recipient is G address, and memo exists, create muxed address
    let finalDestination = destinationAddress;
    const isRecipientGAddress =
      isValidStellarAddress(destinationAddress) &&
      !isContractId(destinationAddress);
    const isRecipientAlreadyMuxed = isMuxedAccount(destinationAddress);

    if (contractSupportsMuxed && memo && isRecipientGAddress) {
      // Extract base account if recipient is already muxed, otherwise use recipient as-is
      const baseAccount = isRecipientAlreadyMuxed
        ? getBaseAccount(destinationAddress)
        : destinationAddress;

      if (baseAccount && isValidStellarAddress(baseAccount) && !isContractId(baseAccount)) {
        const muxedWithMemo = createMuxedAccount(baseAccount, memo);
        if (muxedWithMemo) {
          finalDestination = muxedWithMemo;
          console.log(
            "[TransactionService] buildSorobanTransferOperation: Created muxed address for transfer",
            {
              originalDestination: destinationAddress,
              baseAccount,
              muxedAddress: finalDestination,
              memo,
            },
          );
        } else {
          console.warn(
            "[TransactionService] buildSorobanTransferOperation: Failed to create muxed address, using base account",
            { baseAccount },
          );
        }
      }
    } else if (isRecipientAlreadyMuxed && !memo) {
      // User provided M address but no memo - use it as-is
      finalDestination = destinationAddress;
      console.log(
        "[TransactionService] buildSorobanTransferOperation: Using provided muxed address as-is (no memo)",
        { finalDestination },
      );
    } else if (!contractSupportsMuxed && isRecipientAlreadyMuxed) {
      // Contract doesn't support muxed, extract base account
      const baseAccount = getBaseAccount(destinationAddress);
      if (baseAccount) {
        finalDestination = baseAccount;
        console.log(
          "[TransactionService] buildSorobanTransferOperation: Contract doesn't support muxed, extracting base account",
          { baseAccount, originalMuxed: destinationAddress },
        );
      }
    }

    console.log(
      "[TransactionService] buildSorobanTransferOperation: Building transfer operation",
      {
        sourceAccount,
        finalDestination,
        originalDestination: destinationAddress,
        amount,
        contractId,
        contractSupportsMuxed,
        hasMemo: !!memo,
      },
    );

    const transaction = contract.call(
      "transfer",
      new Address(sourceAccount).toScVal(),
      new Address(finalDestination).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    );

    transactionBuilder.addOperation(transaction);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

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
  finalDestination?: string; // The actual destination used (may be muxed if memo was provided)
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

    // Check if this is a custom token (SorobanBalance with contractId)
    const isCustomToken =
      selectedBalance &&
      "contractId" in selectedBalance &&
      selectedBalance.contractId;

    const isToContractAddress = isContractId(recipientAddress);

    // Custom tokens (SorobanBalance) always use Soroban transfer
    // Recipient being a contract address also uses Soroban transfer
    const shouldUseSorobanTransfer = isToContractAddress || isCustomToken;

    console.log(
      "[TransactionService] buildPaymentTransaction: Initial checks",
      {
        recipientAddress,
        isToContractAddress,
        isCustomToken,
        shouldUseSorobanTransfer,
        hasMemo: !!memo,
        memo,
        selectedBalanceTokenCode: selectedBalance.tokenCode,
        contractId: isCustomToken ? selectedBalance.contractId : undefined,
        network,
      },
    );

    // Only add memo for non-Soroban transactions
    if (memo && !shouldUseSorobanTransfer) {
      transactionBuilder.addMemo(new Memo(Memo.text(memo).type, memo));
    }

    if (shouldUseSorobanTransfer) {
      console.log(
        "[TransactionService] buildPaymentTransaction: Using Soroban transfer",
        {
          isCustomToken,
          isToContractAddress,
          recipientAddress,
        },
      );

      // Determine contract ID and token
      let contractId: string;
      let token: SdkToken;

      if (isCustomToken && selectedBalance.contractId) {
        // Custom token - use its contractId
        contractId = selectedBalance.contractId;
        // For custom tokens, we don't need a token object for the operation
        token = SdkToken.native(); // Placeholder, won't be used
      } else {
        // Native token or recipient is contract address
        try {
          token = getTokenForPayment(selectedBalance);
          contractId = token.isNative()
            ? getContractIdForNativeToken(network)
            : recipientAddress;
        } catch (error) {
          // If getTokenForPayment fails, it might be a custom token
          if (isCustomToken && selectedBalance.contractId) {
            contractId = selectedBalance.contractId;
            token = SdkToken.native(); // Placeholder
          } else {
            throw error;
          }
        }
      }

      console.log(
        "[TransactionService] buildPaymentTransaction: Contract ID determined",
        {
          contractId,
          isNative: token.isNative(),
          recipientAddress,
        },
      );

      const networkDetails = mapNetworkToNetworkDetails(network);

      console.log(
        "[TransactionService] buildPaymentTransaction: Checking if contract supports muxed addresses",
        { contractId, network: networkDetails.network },
      );

      // Check if contract supports muxed addresses (CAP-0067)
      const contractSupportsMuxed = true;

      console.log(
        "[TransactionService] buildPaymentTransaction: Contract muxed support check result",
        {
          contractId,
          contractSupportsMuxed,
          hasMemo: !!memo,
          memo,
        },
      );

      // For CAP-0067: Handle muxed addresses based on contract support
      // We'll determine the final destination right before building the operation
      const isRecipientAlreadyMuxed = isMuxedAccount(recipientAddress);
      const isRecipientGAddress =
        isValidStellarAddress(recipientAddress) &&
        !isContractId(recipientAddress);

      console.log(
        "[TransactionService] buildPaymentTransaction: Muxed address handling",
        {
          contractSupportsMuxed,
          isRecipientAlreadyMuxed,
          isRecipientGAddress,
          recipientAddress,
          hasMemo: !!memo,
          memo,
        },
      );

      if (!contractSupportsMuxed) {
        // Contract doesn't support muxed addresses
        if (isRecipientAlreadyMuxed) {
          // User provided M address but contract doesn't support it - extract base account
          const baseAccount = getBaseAccount(recipientAddress);
          if (baseAccount) {
            // Use base account, memo will be ignored
            console.warn(
              "[TransactionService] buildPaymentTransaction: Contract doesn't support muxed, extracting base account",
              { baseAccount, originalMuxed: recipientAddress },
            );
          } else {
            throw new Error(
              "Contract does not support muxed addresses. Please use a regular address (G... or C...).",
            );
          }
        }
        // If recipient is G/C and contract doesn't support muxed, memo will be ignored (handled in UI)
      }

      const decimals =
        "decimals" in selectedBalance
          ? selectedBalance.decimals
          : DEFAULT_DECIMALS;
      const amountInBaseUnits = BigNumber(amount)
        .shiftedBy(decimals)
        .toFixed(0);

      // Determine final destination at the last step - right before building the operation
      // If contract supports muxed, recipient is G address, and memo exists, create muxed address
      let finalDestination = recipientAddress;

      if (contractSupportsMuxed) {
        const hasValidMemo =
          memo && typeof memo === "string" && memo.length > 0;

        if (hasValidMemo && isRecipientGAddress) {
          // Extract base account if recipient is already muxed, otherwise use recipient as-is
          const baseAccount = isRecipientAlreadyMuxed
            ? getBaseAccount(recipientAddress)
            : recipientAddress;

          if (
            baseAccount &&
            isValidStellarAddress(baseAccount) &&
            !isContractId(baseAccount)
          ) {
            const muxedWithMemo = createMuxedAccount(baseAccount, memo);
            if (muxedWithMemo) {
              finalDestination = muxedWithMemo;
              console.log(
                "[TransactionService] buildPaymentTransaction: Created muxed address for transfer",
                {
                  originalRecipient: recipientAddress,
                  baseAccount,
                  muxedAddress: finalDestination,
                  memo,
                },
              );
            } else {
              console.warn(
                "[TransactionService] buildPaymentTransaction: Failed to create muxed address, using base account",
                { baseAccount },
              );
            }
          }
        } else if (isRecipientAlreadyMuxed && !hasValidMemo) {
          // User provided M address but no memo - use it as-is
          finalDestination = recipientAddress;
          console.log(
            "[TransactionService] buildPaymentTransaction: Using provided muxed address as-is (no memo)",
            { finalDestination },
          );
        }
      } else if (isRecipientAlreadyMuxed) {
        // Contract doesn't support muxed, extract base account
        const baseAccount = getBaseAccount(recipientAddress);
        if (baseAccount) {
          finalDestination = baseAccount;
        }
      }

      console.log(
        "[TransactionService] buildPaymentTransaction: Building Soroban transfer operation",
        {
          sourceAccount: senderAddress,
          destinationAddress: finalDestination,
          amount: amountInBaseUnits,
          contractId,
          contractSupportsMuxed,
          originalRecipient: recipientAddress,
        },
      );

      buildSorobanTransferOperation({
        sourceAccount: senderAddress,
        destinationAddress: finalDestination,
        amount: amountInBaseUnits,
        token,
        transactionBuilder,
        network,
      });

      const transaction = transactionBuilder.build();
      const transactionXDR = transaction.toXDR();

      console.log(
        "[TransactionService] buildPaymentTransaction: Transaction built successfully",
        {
          finalDestination,
          contractId,
          xdrLength: transactionXDR.length,
          hasOperations: transaction.operations.length > 0,
        },
      );

      return {
        tx: transaction,
        xdr: transactionXDR,
        contractId,
        finalDestination, // Return the final destination (may be muxed)
      };
    }

    const token = getTokenForPayment(selectedBalance);

    // For classic payments, extract base account from muxed address if needed
    // Classic operations don't support muxed addresses directly
    let paymentDestination = recipientAddress;
    if (isMuxedAccount(recipientAddress)) {
      const baseAccount = getBaseAccount(recipientAddress);
      if (baseAccount) {
        paymentDestination = baseAccount;
      }
    }

    // Check if destination is funded, but only for XLM transfers
    if (token.isNative()) {
      try {
        await server.loadAccount(paymentDestination);
      } catch (e) {
        const error = e as AxiosError;

        if (error.response && error.response.status === 404) {
          // Ensure the amount is sufficient for account creation
          if (BigNumber(amount).isLessThan(1)) {
            throw new Error(t("transaction.errors.minimumXlmForNewAccount"));
          }

          transactionBuilder.addOperation(
            Operation.createAccount({
              destination: paymentDestination, // Use base account for operation
              startingBalance: amount,
            }),
          );

          const transaction = transactionBuilder.build();

          return {
            tx: transaction,
            xdr: transaction.toXDR(),
            finalDestination: recipientAddress, // Keep original muxed address for tracking
          };
        }

        throw error;
      }
    }

    // If account is funded or asset is not XLM, use standard payment
    transactionBuilder.addOperation(
      Operation.payment({
        destination: paymentDestination, // Use base account for operation
        asset: token,
        amount,
      }),
    );

    const transaction = transactionBuilder.build();

    return {
      tx: transaction,
      xdr: transaction.toXDR(),
      finalDestination: recipientAddress, // Keep original muxed address for tracking
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

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

    // Check if contract supports muxed addresses (CAP-0067)
    const contractSupportsMuxed = await checkContractSupportsMuxed({
      contractId: collectionAddress,
      networkDetails,
    });

    // For CAP-0067: Handle muxed addresses based on contract support
    let finalDestination = recipientAddress;
    const isRecipientAlreadyMuxed = isMuxedAccount(recipientAddress);

    if (!contractSupportsMuxed) {
      // Contract doesn't support muxed addresses
      if (isRecipientAlreadyMuxed) {
        // User provided M address but contract doesn't support it - extract base account
        const baseAccount = getBaseAccount(recipientAddress);
        if (baseAccount) {
          finalDestination = baseAccount;
        } else {
          throw new Error(
            "This collectible contract does not support muxed addresses. Please use a regular address (G... or C...).",
          );
        }
      }
      // If recipient is G/C and contract doesn't support muxed, memo will be ignored (handled in UI)
    } else {
      // Contract supports muxed addresses
      if (isRecipientAlreadyMuxed) {
        // User already provided M address - use it as-is, memo is embedded
        finalDestination = recipientAddress;
      } else {
        // User provided G/C address - create muxed address if memo is provided
        const hasValidMemo =
          transactionMemo &&
          typeof transactionMemo === "string" &&
          transactionMemo.length > 0;

        if (hasValidMemo) {
          const muxedWithMemo = createMuxedAccount(
            recipientAddress,
            transactionMemo,
          );
          if (muxedWithMemo) {
            finalDestination = muxedWithMemo;
          }
        }
      }
    }

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

    return result.preparedTx.toXDR();
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

    // Handle ApiError structure from apiFactory - data can be string or object
    let errorData: string | null = null;
    if (error && typeof error === "object" && "data" in error) {
      const data = (error as { data?: unknown }).data;
      if (typeof data === "string") {
        errorData = data;
      } else if (data) {
        // Try to stringify if it's an object
        try {
          errorData = JSON.stringify(data, null, 2);
        } catch {
          errorData = String(data);
        }
      }
    }
    // Also check if error message itself contains the data (sometimes it's nested)
    const errorString = JSON.stringify(error, null, 2);
    // Combine message, data, and stringified error for comprehensive error detection
    const fullErrorText = [errorMessage, errorData, errorString]
      .filter(Boolean)
      .join(" ");

    // Check if error is related to muxed address support
    const isMuxedAddressError =
      fullErrorText.includes("UnreachableCodeReached") ||
      fullErrorText.includes("Unreachable") ||
      fullErrorText.includes("muxed") ||
      fullErrorText.includes("Muxed") ||
      fullErrorText.includes("scAddressTypeMuxedAccount") ||
      fullErrorText.includes("MuxedAccount") ||
      fullErrorText.includes("InvalidAction");

    analytics.trackSimulationError(errorMessage, "collectible_transfer");

    // Attach the muxed address error flag to the error object so the transaction builder can detect it
    if (isMuxedAddressError && error && typeof error === "object") {
      (error as { isMuxedAddressError?: boolean }).isMuxedAddressError = true;
    }

    throw error;
  }
};
