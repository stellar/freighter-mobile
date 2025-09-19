import Blockaid from "@blockaid/client";

export const beningTokenScan: Blockaid.TokenScanResponse = {
  address: "",
  chain: "stellar",
  attack_types: {},
  fees: {},
  malicious_score: "0.0",
  metadata: {},
  financial_stats: {},
  trading_limits: {},
  result_type: "Benign",
  features: [{ description: "", feature_id: "METADATA", type: "Benign" }],
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
  result_type: "Malicious",
  features: [{ description: "", feature_id: "METADATA", type: "Malicious" }],
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
  result_type: "Warning",
  features: [{ description: "", feature_id: "METADATA", type: "Warning" }],
};
