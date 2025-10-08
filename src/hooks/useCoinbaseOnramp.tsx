import { AnalyticsEvent } from "config/analyticsConfig";
import { logger } from "config/logger";
import { getActiveAccountPublicKey } from "ducks/auth";
import { EnvConfig } from "helpers/getEnvConfig";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useCallback, useEffect, useState } from "react";
import { analytics } from "services/analytics";

interface GetCoinBaseUrlParams {
  sessionToken: string;
  token?: string;
}

const getCoinbaseUrl = ({ sessionToken, token }: GetCoinBaseUrlParams) => {
  const selectedToken = token ? `&defaultAsset=${token}` : "";

  return `https://pay.coinbase.com/buy/select-asset?sessionToken=${sessionToken}&defaultExperience=buy${selectedToken}`;
};

interface UseCoinbaseOnrampParams {
  token?: string;
}

function useCoinbaseOnramp({ token }: UseCoinbaseOnrampParams) {
  const [isLoading, setIsLoading] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const { open: openInAppBrowser } = useInAppBrowser();

  const fetchData = useCallback(async () => {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: publicKey }),
    };

    const url = `${EnvConfig.FREIGHTER_BACKEND_V1_URL}/onramp/token`;
    const response = await fetch(url, options);
    const { data } = (await response.json()) as {
      data: { token: string; error: string };
    };

    if (!data.token || data.error) {
      throw new Error(data.error || "Failed to fetch onramp token");
    }

    return data;
  }, [publicKey]);

  useEffect(() => {
    const getPublicKey = async () => {
      const pKey = await getActiveAccountPublicKey();
      if (pKey) {
        setPublicKey(pKey);
      }
    };

    getPublicKey();
  }, []);

  const openCoinbaseUrl = useCallback(async () => {
    if (isLoading || !publicKey) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await fetchData();
      const url = getCoinbaseUrl({ sessionToken: data.token, token });

      analytics.track(AnalyticsEvent.COINBASE_ONRAMP_OPENED);

      await openInAppBrowser(url);
    } catch (error) {
      logger.error("useCoinbaseOnramp", "Failed to open Coinbase URL", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchData, isLoading, publicKey, openInAppBrowser]);

  return {
    openCoinbaseUrl,
    isLoading,
  };
}

export { useCoinbaseOnramp };
