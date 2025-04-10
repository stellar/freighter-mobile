import {
  NETWORKS,
  STELLAR_EXPERT_API_URL,
  STELLAR_EXPERT_URL,
} from "config/constants";
import { isTestnet } from "helpers/networks";

export const getStellarExpertUrl = (network: NETWORKS) =>
  `${STELLAR_EXPERT_URL}/${isTestnet(network) ? "testnet" : "public"}`;

export const getApiStellarExpertUrl = (network: NETWORKS) =>
  `${STELLAR_EXPERT_API_URL}/${isTestnet(network) ? "testnet" : "public"}`;
