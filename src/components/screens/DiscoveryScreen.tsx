import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { Display } from "components/sds/Typography";
import { MainTabStackParamList, MAIN_TAB_ROUTES } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = () => {
  const { t } = useAppTranslation();

  return (
    <BaseLayout insets={{ bottom: false }}>
      <Display xs style={{ alignSelf: "center" }}>
        {t("discovery.title")}
      </Display>
    </BaseLayout>
  );
};
