import { BlendPoolIcon } from "components/screens/EarnScreen/components/BlendPoolIcon";
import { useOpenBlendApp } from "components/screens/EarnScreen/hooks/useOpenBlendApp";
import { PositionSection } from "components/screens/PositionsScreen/components/PositionParts";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useCallback } from "react";
import { TouchableOpacity, View } from "react-native";

const PROVIDER_ICON_SIZE = 40;
const PROVIDER_ICON_RADIUS = 10;

/** An outlined pill that opens a page in the in-app browser. */
const OverviewLink: React.FC<{
  label: string;
  onPress: () => void;
  testID: string;
}> = ({ label, onPress, testID }) => {
  const { themeColors } = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="link"
      className="flex-row items-center gap-[4px] self-start rounded-full px-[12px] py-[8px]"
      style={{ borderWidth: 1, borderColor: themeColors.border.primary }}
      testID={testID}
    >
      <Text md semiBold color={themeColors.lilac[9]}>
        {label}
      </Text>
      <Icon.LinkExternal01 size={16} color={themeColors.lilac[9]} />
    </TouchableOpacity>
  );
};

/** A heading over a paragraph. */
const OverviewParagraph: React.FC<{ title: string; body: string }> = ({
  title,
  body,
}) => (
  <PositionSection title={title}>
    <Text md regular primary>
      {body}
    </Text>
  </PositionSection>
);

interface PositionOverviewProps {
  poolId: string;
  /** The pool's name as the app shows it. */
  poolName: string;
}

/**
 * A token position's Overview tab: what the pool is, who runs it, how the
 * funds are managed and what can go wrong, with links to the pool on Blend
 * and its contract on stellar.expert. The same copy for every pool, as in the
 * extension.
 */
export const PositionOverview: React.FC<PositionOverviewProps> = ({
  poolId,
  poolName,
}) => {
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const { open: openInAppBrowser } = useInAppBrowser();
  const handleViewPoolOnBlend = useOpenBlendApp();

  const handleViewContract = useCallback(() => {
    openInAppBrowser(
      `${getStellarExpertUrl(network)}/contract/${poolId}`,
    ).catch((error) =>
      logger.error(
        "PositionOverview",
        "Failed to open the pool's contract",
        error,
      ),
    );
  }, [openInAppBrowser, network, poolId]);

  return (
    <View className="gap-[24px]" testID="token-position-overview">
      <OverviewParagraph
        title={t("positions.overview.aboutPool")}
        body={t("positions.overview.aboutPoolBody", { pool: poolName })}
      />

      <PositionSection title={t("positions.overview.provider")}>
        <View className="flex-row items-center gap-[12px]">
          <BlendPoolIcon
            style={{
              width: PROVIDER_ICON_SIZE,
              height: PROVIDER_ICON_SIZE,
              borderRadius: PROVIDER_ICON_RADIUS,
            }}
          />
          {/* Blend's name, not copy: the same in every language. */}
          <Text md medium primary>
            Blend
          </Text>
        </View>
      </PositionSection>

      <OverviewParagraph
        title={t("positions.overview.fundsManaged")}
        body={t("positions.overview.fundsManagedBody")}
      />

      <OverviewParagraph
        title={t("positions.overview.risks")}
        body={t("positions.overview.risksBody")}
      />

      <PositionSection title={t("positions.overview.links")}>
        <View className="gap-[12px]">
          <OverviewLink
            label={t("positions.overview.viewPoolOnBlend")}
            onPress={handleViewPoolOnBlend}
            testID="token-position-blend-link"
          />
          <OverviewLink
            label={t("positions.overview.viewContract")}
            onPress={handleViewContract}
            testID="token-position-explorer-link"
          />
        </View>
      </PositionSection>
    </View>
  );
};
