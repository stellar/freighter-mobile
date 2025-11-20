/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { Horizon, Asset as SdkToken } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { NATIVE_TOKEN_CODE, NetworkDetails } from "config/constants";
import {
  SorobanTokenInterface,
  getAttrsFromSorobanHorizonOp,
  isContractId,
  getNativeContractDetails,
} from "helpers/soroban";

type OperationWithSpamCheckAttr = Horizon.ServerApi.OperationRecord & {
  transaction_attr?: {
    operation_count?: number;
    successful?: boolean;
  };
};

export const getIsPayment = (type: Horizon.HorizonApi.OperationResponseType) =>
  [
    Horizon.HorizonApi.OperationResponseType.payment,
    Horizon.HorizonApi.OperationResponseType.pathPayment,
    Horizon.HorizonApi.OperationResponseType.pathPaymentStrictSend,
  ].includes(type);

export const getIsSwap = (operation: Horizon.ServerApi.OperationRecord) =>
  operation.type_i === 13 && operation.source_account === operation.to;

export const getIsDustPayment = (
  publicKey: string,
  operation: Horizon.ServerApi.OperationRecord,
) =>
  getIsPayment(operation.type) &&
  "asset_type" in operation &&
  operation.asset_type === "native" &&
  "to" in operation &&
  operation.to === publicKey &&
  "amount" in operation &&
  new BigNumber(operation.amount).lte(new BigNumber(0.1));

export const getIsCreateClaimableBalanceSpam = (
  operation: Horizon.ServerApi.OperationRecord,
): boolean => {
  const opWithAttr = operation as OperationWithSpamCheckAttr;

  if (opWithAttr.type === "create_claimable_balance") {
    const operationCount = opWithAttr.transaction_attr?.operation_count;
    if (operationCount && operationCount > 50) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if an operation is a supported Soroban operation
 */
export const getIsSupportedSorobanOp = (
  operation: Horizon.ServerApi.OperationRecord,
  networkDetails: NetworkDetails,
): boolean => {
  const attrs = getAttrsFromSorobanHorizonOp(operation, networkDetails);

  if (!attrs || typeof attrs !== "object" || !("fnName" in attrs)) {
    return false;
  }

  const typedAttrs = attrs as { fnName: string };

  return Object.values(SorobanTokenInterface).includes(
    typedAttrs.fnName as SorobanTokenInterface,
  );
};

/**
 * Extracts token code and issuer from a tokenId
 * tokenId format:
 * - "native" for XLM
 * - "CODE:ISSUER" for classic tokens
 * - Contract address for Soroban tokens
 * - "SYMBOL:CONTRACTID" for Soroban tokens with symbol
 *
 * @param tokenId - The token identifier string
 * @returns Token information object with possible signatures:
 *   - { code: "XLM", issuer: undefined, contractId: undefined } for native tokens
 *   - { code: undefined, issuer: undefined, contractId: string } for Soroban tokens (contract ID only)
 *   - { code: string, issuer: undefined, contractId: string } for Soroban tokens (SYMBOL:CONTRACTID format)
 *   - { code: string, issuer: string, contractId: undefined } for classic tokens (CODE:ISSUER format)
 */
export const getTokenFromTokenId = (tokenId: string) => {
  if (tokenId === "native") {
    return { code: "XLM", issuer: undefined, contractId: undefined };
  }

  if (isContractId(tokenId)) {
    return { code: undefined, issuer: undefined, contractId: tokenId };
  }

  // Check if it's SYMBOL:CONTRACTID format (Soroban token)
  // Split by : and check if the second part is a contract ID
  const parts = tokenId.split(":");
  if (parts.length === 2 && isContractId(parts[1])) {
    // This is a Soroban token in SYMBOL:CONTRACTID format
    return { code: parts[0], issuer: undefined, contractId: parts[1] };
  }

  // Classic token format: CODE:ISSUER
  const [code, issuer] = tokenId.split(":");

  return { code, issuer, contractId: undefined };
};

/**
 * Checks if an operation involves a specific token (classic or Soroban)
 */
export const operationInvolvesToken = (
  operation: Horizon.ServerApi.OperationRecord,
  targetToken: { code?: string; issuer?: string; contractId?: string },
  networkDetails: NetworkDetails,
): boolean => {
  // Handle Soroban token operations
  if (
    targetToken.contractId &&
    getIsSupportedSorobanOp(operation, networkDetails)
  ) {
    const attrs = getAttrsFromSorobanHorizonOp(operation, networkDetails);

    if (attrs && typeof attrs === "object" && "contractId" in attrs) {
      const typedAttrs = attrs as { contractId: string };

      return typedAttrs.contractId === targetToken.contractId;
    }

    return false;
  }

  // Handle native XLM operations (both classic and Soroban)
  if (targetToken.code === NATIVE_TOKEN_CODE && !targetToken.contractId) {
    // Check for classic payment operations
    if (getIsPayment(operation.type)) {
      if ("asset_type" in operation && operation.asset_type === "native") {
        return true;
      }

      if (
        "source_asset_type" in operation &&
        operation.source_asset_type === "native"
      ) {
        return true;
      }
    }

    // Check for Soroban operations involving native XLM contract
    if (getIsSupportedSorobanOp(operation, networkDetails)) {
      const attrs = getAttrsFromSorobanHorizonOp(operation, networkDetails);

      if (attrs && typeof attrs === "object" && "contractId" in attrs) {
        const typedAttrs = attrs as { contractId: string };
        const nativeContractDetails = getNativeContractDetails(
          networkDetails.network,
        );

        return typedAttrs.contractId === nativeContractDetails.contract;
      }
    }

    return false;
  }

  // Handle classic asset operations (both classic payments and Soroban SAC operations)
  if (!targetToken.contractId && targetToken.code && targetToken.issuer) {
    const targetCode = targetToken.code;
    const targetIssuer = targetToken.issuer;

    // Check for classic payment operations
    if (getIsPayment(operation.type)) {
      if ("asset_type" in operation) {
        const opTokenCode =
          "asset_code" in operation ? operation.asset_code : undefined;
        const opAssetIssuer =
          "asset_issuer" in operation ? operation.asset_issuer : undefined;

        if (opTokenCode === targetCode && opAssetIssuer === targetIssuer) {
          return true;
        }
      }

      if ("source_asset_type" in operation) {
        const sourceTokenCode =
          "source_asset_code" in operation
            ? operation.source_asset_code
            : undefined;
        const sourceTokenIssuer =
          "source_asset_issuer" in operation
            ? operation.source_asset_issuer
            : undefined;

        if (
          sourceTokenCode === targetCode &&
          sourceTokenIssuer === targetIssuer
        ) {
          return true;
        }
      }
    }

    // Check for Soroban operations involving the Stellar Asset Contract (SAC) for this classic asset
    if (getIsSupportedSorobanOp(operation, networkDetails)) {
      const attrs = getAttrsFromSorobanHorizonOp(operation, networkDetails);
      if (attrs && typeof attrs === "object" && "contractId" in attrs) {
        const typedAttrs = attrs as { contractId: string };

        // For classic tokens, we need to check if the contract ID matches the SAC address for this token
        // The SAC address is deterministic based on the token code and issuer
        try {
          const asset = new SdkToken(targetCode, targetIssuer);
          const sacAddress = asset.contractId(networkDetails.networkPassphrase);

          return typedAttrs.contractId === sacAddress;
        } catch (error) {
          // If we can't calculate the SAC address, fall back to false
          return false;
        }
      }
    }
  }

  return false;
};

/**
 * Filters operations to only include those involving a specific token (classic or Soroban)
 */
export const filterOperationsByToken = (
  operations: Horizon.ServerApi.OperationRecord[],
  tokenId: string,
  networkDetails: NetworkDetails,
): Horizon.ServerApi.OperationRecord[] => {
  const targetToken = getTokenFromTokenId(tokenId);

  return operations.filter((operation) =>
    operationInvolvesToken(operation, targetToken, networkDetails),
  );
};
