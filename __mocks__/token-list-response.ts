import { NETWORKS } from "config/constants";

export const MOCK_TOKEN_LIST_RESPONSE = {
  name: "Mock Tokens List",
  description: "a mock list of verified tokens",
  network: NETWORKS.TESTNET,
  version: "1.0",
  provider: "test-suite",
  assets: [
    {
      code: "FTT",
      issuer: "G..",
      contract: "C..",
      domain: "example.com",
      icon: "example.com/image",
      decimals: 7,
      name: "Freighter Test Token",
    },
  ],
};
