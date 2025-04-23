import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { Display } from "components/sds/Typography";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

type HistoryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HISTORY
>;

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { t } = useAppTranslation();

  return (
    <BaseLayout insets={{ bottom: false }}>
      <Display sm style={{ alignSelf: "center" }}>
        {t("history.title")}
      </Display>
    </BaseLayout>
  );
};
