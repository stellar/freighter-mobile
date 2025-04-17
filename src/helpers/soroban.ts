import { StrKey } from "@stellar/stellar-sdk";
import { NETWORKS } from "config/constants";

export const isContractId = (contractId: string) => {
  try {
    StrKey.decodeContract(contractId);
    return true;
  } catch (error) {
    return false;
  }
};

export const getNativeContractDetails = (network: NETWORKS) => {
  const NATIVE_CONTRACT_DEFAULTS = {
    code: "XLM",
    decimals: 7,
    domain: "https://stellar.org",
    icon: "",
    org: "",
  };

  switch (network) {
    case NETWORKS.PUBLIC:
      return {
        ...NATIVE_CONTRACT_DEFAULTS,
        contract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        issuer: "GDMTVHLWJTHSUDMZVVMXXH6VJHA2ZV3HNG5LYNAZ6RTWB7GISM6PGTUV",
      };
    case NETWORKS.TESTNET:
      return {
        ...NATIVE_CONTRACT_DEFAULTS,
        contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        issuer: "",
      };
    default:
      return { ...NATIVE_CONTRACT_DEFAULTS, contract: "", issuer: "" };
  }
};
