import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  FormattedSearchTokenRecord,
  TokenTypeWithCustomToken,
} from "config/types";
import { getTokenDetails } from "services/backend";

/**
 * Calls `apply` with the record once its decimals are known. A Soroban token
 * the account doesn't hold reads them through /token-details, never from
 * stellar.expert, whose value comes from the issuer's toml. If they stay
 * unknown the token is refused: amounts and minOut can't be scaled without
 * them.
 */
export const withTokenDecimals = (
  record: FormattedSearchTokenRecord,
  { publicKey, network }: { publicKey: string; network: NETWORKS },
  apply: (record: FormattedSearchTokenRecord) => void,
  fail: () => void,
): void => {
  if (
    record.tokenType !== TokenTypeWithCustomToken.CUSTOM_TOKEN ||
    (record.hasTrustline && record.decimals !== undefined)
  ) {
    apply(record);
    return;
  }
  getTokenDetails({ contractId: record.issuer, publicKey, network })
    .then((details) => {
      if (typeof details?.decimals !== "number") {
        throw new Error("token details have no decimals");
      }
      apply({ ...record, decimals: details.decimals });
    })
    .catch((error) => {
      logger.error(
        "withTokenDecimals",
        `Can't read decimals for swap token ${record.issuer}`,
        error,
      );
      fail();
    });
};
