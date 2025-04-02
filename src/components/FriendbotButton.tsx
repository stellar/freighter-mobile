import { Button } from "components/sds/Button";
import { NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
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
    await fundAccount(publicKey, network);
    setIsLoading(false);

    // Refresh the balances
    await fetchAccountBalances({
      publicKey,
      network,
    });
  };

  return (
    <Button isFullWidth isLoading={isLoading} onPress={handleFundAccount}>
      {t("friendbotButton.title")}
    </Button>
  );
};
