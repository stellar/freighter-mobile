import { FRIENDBOT_URLS, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { createApiService, logApiError } from "services/apiFactory";

// Create a dedicated API service for backend operations
const friendBotTestnet = createApiService({
  baseURL: FRIENDBOT_URLS.TESTNET,
});

const friendBotFuturenet = createApiService({
  baseURL: FRIENDBOT_URLS.FUTURENET,
});

export const fundAccount = async (publicKey: string, network: NETWORKS) => {
  if (![NETWORKS.TESTNET, NETWORKS.FUTURENET].includes(network)) {
    logger.error("friendbot", "Unsupported network", network);

    return;
  }

  const friendBot =
    network === NETWORKS.FUTURENET ? friendBotFuturenet : friendBotTestnet;

  try {
    await friendBot.get(`?addr=${encodeURIComponent(publicKey)}`);
  } catch (error) {
    logApiError(
      "friendbot",
      "Network unreachable while funding account",
      "Error funding account",
      error,
    );
  }
};
