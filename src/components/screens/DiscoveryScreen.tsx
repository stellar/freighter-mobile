import { BaseLayout } from "components/layout/BaseLayout";
import { Display } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

export const DiscoveryScreen = () => {
  const { t } = useAppTranslation();

  return (
    <BaseLayout insets={{ bottom: false, left: true, right: true, top: true }}>
      <Display sm style={{ alignSelf: "center" }}>
        {t("discovery.title")}
      </Display>
    </BaseLayout>
  );
};
