/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { Horizon } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";

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
