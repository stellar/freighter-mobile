import { Button } from "components/sds/Button";
import { NETWORKS } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
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

  const { handleRefresh } = useBalancesList({ publicKey, network });

  const handleFundAccount = async () => {
    setIsLoading(true);
    await fundAccount(publicKey, network);
    setIsLoading(false);

    handleRefresh();
  };

  return (
    <Button
      isFullWidth
      isLoading={isLoading}
      onPress={handleFundAccount}
      testID="friendbot-button"
    >
      {t("friendbotButton.title")}
    </Button>
  );
};
