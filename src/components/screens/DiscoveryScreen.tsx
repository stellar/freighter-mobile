import { BaseLayout } from "components/layout/BaseLayout";
import { Display } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

export const DiscoveryScreen = () => {
  const { t } = useAppTranslation();

  return (
    <BaseLayout>
      <Display sm style={{ alignSelf: "center", marginTop: 40 }}>
        {t("discovery.title")}
      </Display>
    </BaseLayout>
  );
};
