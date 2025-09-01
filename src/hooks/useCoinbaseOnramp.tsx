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
  const [sessionTokenError, setSessionTokenError] = useState("");
  const [coinbaseUrl, setCoinbaseUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async (publicKey: string) => {
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
        setSessionTokenError(data.error);
        setIsLoading(false);
        return data;
      }

      setIsLoading(false);
      return data;
    } catch (error) {
      setSessionTokenError(error as string);
      return error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const getOnRampToken = async () => {
      const publicKey = await getActiveAccountPublicKey();

      if (!publicKey) {
        return;
      }

      const data = (await fetchData(publicKey)) as {
        token: string;
        error: string;
      };

      if (data.token && !data.error) {
        const url = getCoinbaseUrl({ sessionToken: data.token, token });
        setCoinbaseUrl(url);
      }
    };

    getOnRampToken();
  }, [fetchData, token]);

  const clearTokenError = () => {
    setSessionTokenError("");
  };

  const openCoinbaseUrl = useCallback(async () => {
    if (coinbaseUrl) {
      try {
        const supported = await Linking.canOpenURL(coinbaseUrl);
        if (supported) {
          await Linking.openURL(coinbaseUrl);
        } else {
          setSessionTokenError("Cannot open Coinbase URL");
        }
      } catch (error) {
        setSessionTokenError("Failed to open Coinbase URL");
      }
    }
  }, [coinbaseUrl]);

  return {
    fetchData,
    sessionTokenError,
    clearTokenError,
    coinbaseUrl,
    isLoading,
    openCoinbaseUrl,
  };
}

export { useCoinbaseOnramp };
