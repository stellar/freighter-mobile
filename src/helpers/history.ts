/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { Horizon, Asset } from "@stellar/stellar-sdk";
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
 * Extracts asset code and issuer from a tokenId
 * tokenId format:
 * - "native" for XLM
 * - "CODE:ISSUER" for classic assets
 * - Contract address for Soroban tokens
 */
export const getAssetFromTokenId = (tokenId: string) => {
  if (tokenId === "native") {
    return { code: "XLM", issuer: undefined, contractId: undefined };
  }

  if (isContractId(tokenId)) {
    return { code: undefined, issuer: undefined, contractId: tokenId };
  }

  // Classic asset format: CODE:ISSUER
  const [code, issuer] = tokenId.split(":");

  return { code, issuer, contractId: undefined };
};

/**
 * Checks if an operation involves a specific asset (classic or Soroban)
 */
export const operationInvolvesAsset = (
  operation: Horizon.ServerApi.OperationRecord,
  targetAsset: { code?: string; issuer?: string; contractId?: string },
  networkDetails: NetworkDetails,
): boolean => {
  // Handle Soroban token operations
  if (
    targetAsset.contractId &&
    getIsSupportedSorobanOp(operation, networkDetails)
  ) {
    const attrs = getAttrsFromSorobanHorizonOp(operation, networkDetails);

    if (attrs && typeof attrs === "object" && "contractId" in attrs) {
      const typedAttrs = attrs as { contractId: string };

      return typedAttrs.contractId === targetAsset.contractId;
    }

    return false;
  }

  // Handle native XLM operations (both classic and Soroban)
  if (targetAsset.code === NATIVE_TOKEN_CODE && !targetAsset.contractId) {
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
  if (!targetAsset.contractId && targetAsset.code && targetAsset.issuer) {
    const targetCode = targetAsset.code;
    const targetIssuer = targetAsset.issuer;

    // Check for classic payment operations
    if (getIsPayment(operation.type)) {
      if ("asset_type" in operation) {
        const opAssetCode =
          "asset_code" in operation ? operation.asset_code : undefined;
        const opAssetIssuer =
          "asset_issuer" in operation ? operation.asset_issuer : undefined;

        if (opAssetCode === targetCode && opAssetIssuer === targetIssuer) {
          return true;
        }
      }

      if ("source_asset_type" in operation) {
        const sourceAssetCode =
          "source_asset_code" in operation
            ? operation.source_asset_code
            : undefined;
        const sourceAssetIssuer =
          "source_asset_issuer" in operation
            ? operation.source_asset_issuer
            : undefined;

        if (
          sourceAssetCode === targetCode &&
          sourceAssetIssuer === targetIssuer
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

        // For classic assets, we need to check if the contract ID matches the SAC address for this asset
        // The SAC address is deterministic based on the asset code and issuer
        try {
          const asset = new Asset(targetCode, targetIssuer);
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
 * Filters operations to only include those involving a specific asset (classic or Soroban)
 */
export const filterOperationsByAsset = (
  operations: Horizon.ServerApi.OperationRecord[],
  tokenId: string,
  networkDetails: NetworkDetails,
): Horizon.ServerApi.OperationRecord[] => {
  const targetAsset = getAssetFromTokenId(tokenId);

  return operations.filter((operation) =>
    operationInvolvesAsset(operation, targetAsset, networkDetails),
  );
};
