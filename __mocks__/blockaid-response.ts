import Blockaid from "@blockaid/client";
import { BLOCKAID_RESULT_TYPES } from "services/blockaid/constants";

export const benignTokenScan: Blockaid.TokenScanResponse = {
  address: "",
  chain: "stellar",
  attack_types: {},
  fees: {},
  malicious_score: "0.0",
  metadata: {},
  financial_stats: {},
  trading_limits: {},
  result_type: BLOCKAID_RESULT_TYPES.BENIGN,
  features: [
    {
      description: "",
      feature_id: "METADATA",
      type: BLOCKAID_RESULT_TYPES.BENIGN,
    },
  ],
};

export const maliciousTokenScan: Blockaid.TokenScanResponse = {
  address: "",
  chain: "stellar",
  attack_types: {},
  fees: {},
  malicious_score: "0.0",
  metadata: {},
  financial_stats: {},
  trading_limits: {},
  result_type: BLOCKAID_RESULT_TYPES.MALICIOUS,
  features: [
    {
      description: "",
      feature_id: "METADATA",
      type: BLOCKAID_RESULT_TYPES.MALICIOUS,
    },
  ],
};

export const suspiciousTokenScan: Blockaid.TokenScanResponse = {
  address: "",
  chain: "stellar",
  attack_types: {},
  fees: {},
  malicious_score: "0.0",
  metadata: {},
  financial_stats: {},
  trading_limits: {},
  result_type: BLOCKAID_RESULT_TYPES.WARNING,
  features: [
    {
      description: "",
      feature_id: "METADATA",
      type: BLOCKAID_RESULT_TYPES.WARNING,
    },
  ],
};
