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

interface UseCoinbaseOnrampParams {
  token?: string;
}

function useCoinbaseOnramp({ token }: UseCoinbaseOnrampParams) {
  const [isLoading, setIsLoading] = useState(false);
  const [publicKey, setPublicKey] = useState("");

  const fetchData = useCallback(async () => {
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

      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        throw new Error("Cannot open Coinbase URL");
      }

      await Linking.openURL(url);
    } catch (error) {
      logger.error("useCoinbaseOnramp", "Failed to open Coinbase URL", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchData, isLoading, publicKey]);

  return {
    openCoinbaseUrl,
    isLoading,
  };
}

export { useCoinbaseOnramp };
