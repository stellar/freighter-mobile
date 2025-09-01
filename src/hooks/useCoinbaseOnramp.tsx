import { logger } from "config/logger";
import { getActiveAccountPublicKey } from "ducks/auth";
import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";
import Config from "react-native-config";

interface GetCoinBaseUrlParams {
  sessionToken: string;
  token?: string;
}

const getCoinbaseUrl = ({ sessionToken, token }: GetCoinBaseUrlParams) => {
  const selectedToken = token ? `&defaultAsset=${token}` : "";

  return `https://pay.coinbase.com/buy/select-asset?sessionToken=${sessionToken}&defaultExperience=buy${selectedToken}`;
};

interface OnrampTokenResponse {
  token: string;
  error: string;
}

interface UseCoinbaseOnrampParams {
  token?: string;
}

function useCoinbaseOnramp({ token }: UseCoinbaseOnrampParams) {
  const [isLoading, setIsLoading] = useState(false);
  const [publicKey, setPublicKey] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: publicKey }),
      };
      const url = `${Config.INDEXER_URL}/onramp/token`;
      const response = await fetch(url, options);
      const { data } = (await response.json()) as {
        data: { token: string; error: string };
      };

      if (!data.token || data.error) {
        logger.error(
          "useCoinbaseOnramp",
          "unable to fetch onramp token",
          data.error,
        );
        setIsLoading(false);
        return data;
      }

      setIsLoading(false);
      return data;
    } catch (error) {
      logger.error("useCoinbaseOnramp", "unable to fetch onramp token", error);
      return error;
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    const getPublicKey = async () => {
      const pKey = await getActiveAccountPublicKey();

      if (pKey) {
        setPublicKey(pKey);
      }
    };

    getPublicKey();
  }, [fetchData, token]);

  const openCoinbaseUrl = useCallback(async () => {
    if (isLoading || !publicKey) {
      return;
    }

    const data = (await fetchData()) as OnrampTokenResponse;
    if (!data.token || data.error) {
      logger.error(
        "useCoinbaseOnramp",
        "unable to fetch onramp token",
        data.error,
      );
      return;
    }

    const url = getCoinbaseUrl({ sessionToken: data.token, token });
    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          logger.error("useCoinbaseOnramp", "cannot open Coinbase URL");
        }
      } catch (error) {
        logger.error("useCoinbaseOnramp", "failed to open Coinbase URL", error);
      }
    }
  }, [token, fetchData, isLoading, publicKey]);

  return {
    openCoinbaseUrl,
  };
}

export { useCoinbaseOnramp };
