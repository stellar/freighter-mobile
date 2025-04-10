import { Networks } from "@stellar/stellar-sdk";
import {
  FUTURENET_NETWORK_DETAILS,
  NETWORK_URLS,
  NetworkDetails,
  NETWORKS,
} from "config/constants";

export const isMainnet = (network: NetworkDetails | NETWORKS) => {
  if (typeof network === "object") {
    const { networkPassphrase } = network;
    return networkPassphrase === Networks.PUBLIC;
  }

  return network === NETWORKS.PUBLIC;
};

export const isTestnet = (network: NetworkDetails | NETWORKS) => {
  if (typeof network === "object") {
    const { networkPassphrase, networkUrl } = network;
    return (
      networkPassphrase === Networks.TESTNET &&
      networkUrl === NETWORK_URLS.TESTNET
    );
  }

  return network === NETWORKS.TESTNET;
};

export const isFuturenet = (network: NetworkDetails | NETWORKS) => {
  if (typeof network === "object") {
    const { networkPassphrase, networkUrl } = network;
    return (
      networkPassphrase === FUTURENET_NETWORK_DETAILS.networkPassphrase &&
      networkUrl === NETWORK_URLS.FUTURENET
    );
  }

  return network === NETWORKS.FUTURENET;
};
