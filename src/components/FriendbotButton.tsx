import { Button } from "components/sds/Button";
import { NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import { debug } from "helpers/debug";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";
import { fundAccount } from "services/friendbot";

export const FriendbotButton = ({
  publicKey,
  network,
}: {
  publicKey: string;
  network: NETWORKS;
}) => {
  const { t } = useAppTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const { fetchAccountBalances } = useBalancesStore();

  const handleFundAccount = async () => {
    setIsLoading(true);
    try {
      await fundAccount(publicKey, network);
      await fetchAccountBalances({ publicKey, network });
    } catch (error) {
      debug("FriendbotButton", "Error funding account:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      isFullWidth
      isLoading={isLoading}
      onPress={handleFundAccount}
      testID="friendbot-button"
      tertiary
    >
      {t("friendbotButton.title")}
    </Button>
  );
};
