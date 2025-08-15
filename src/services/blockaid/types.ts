import { NETWORKS } from "config/constants";
import {
  BLOCKAID_RESULT_TYPES,
  SecurityLevel,
} from "services/blockaid/constants";

export interface BlockaidApiResponseSuccess<T> {
  data: T;
  error: null;
}

export interface BlockaidApiResponseError {
  data: null;
  error: string;
}

export type BlockaidApiResponse<T> =
  | BlockaidApiResponseSuccess<T>
  | BlockaidApiResponseError;

export interface ScanTokenParams {
  tokenCode: string;
  tokenIssuer?: string;
  network: NETWORKS;
}

export interface ScanSiteParams {
  url: string;
  network: NETWORKS;
}

export interface ScanTransactionParams {
  xdr: string;
  url: string;
  network: NETWORKS;
}

export interface SecurityAssessment {
  level: SecurityLevel;
  isSuspicious: boolean;
  isMalicious: boolean;
  details?: string;
}

export type BlockaidResultType =
  (typeof BLOCKAID_RESULT_TYPES)[keyof typeof BLOCKAID_RESULT_TYPES];

export const isValidBlockaidResultType = (
  resultType: string,
): resultType is BlockaidResultType =>
  Object.values(BLOCKAID_RESULT_TYPES).includes(
    resultType as BlockaidResultType,
  );
