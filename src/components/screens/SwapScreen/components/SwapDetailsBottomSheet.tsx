import { BottomSheetHeader } from "components/BottomSheetHeader";
import { List } from "components/List";
import { SwapRouteContent } from "components/screens/SwapScreen/components/SwapRouteContent";
import { SwapVenueIconStack } from "components/screens/SwapScreen/components/SwapVenueIcon";
import {
  MAX_PATH_VENUE_ICONS,
  SwapRouteView,
} from "components/screens/SwapScreen/helpers";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { View } from "react-native";

export interface SwapDetailsBottomSheetProps {
  /** e.g. "0.00001 XLM" */
  networkFee: string;
  /** e.g. "$0.22"; omitted when it would round to $0.00 or there's no price. */
  networkFeeFiat?: string;
  rate: string;
  /** Send's Soroban fee note, for a route whose fee includes a resource fee. */
  showSorobanFeeNote?: boolean;
  /** Null hides the Route row. */
  routeView: SwapRouteView | null;
  onClose: () => void;
}

/** "See details" on the swap amount screen: fee, rate and the route. */
export const SwapDetailsBottomSheet: React.FC<SwapDetailsBottomSheetProps> = ({
  networkFee,
  networkFeeFiat,
  rate,
  showSorobanFeeNote = false,
  routeView,
  onClose,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [showRoute, setShowRoute] = useState(false);

  if (showRoute && routeView) {
    return (
      <SwapRouteContent
        routeView={routeView}
        onBack={() => setShowRoute(false)}
        onClose={onClose}
      />
    );
  }

  const providerCount = routeView?.providers.length ?? 0;
  const routeRow = routeView
    ? [
        {
          key: "route",
          testID: "swap-details-route-row",
          onPress: () => setShowRoute(true),
          titleComponent: (
            <Text md secondary>
              {t("swapScreen.details.route")}
            </Text>
          ),
          trailingContent: (
            <View className="flex-row items-center gap-[8px]">
              <Text md medium>
                {providerCount === 1
                  ? t("swapScreen.details.oneProvider")
                  : t("swapScreen.details.providers", {
                      count: providerCount,
                    })}
              </Text>
              <SwapVenueIconStack
                venues={routeView.providers.slice(0, MAX_PATH_VENUE_ICONS)}
                size={16}
                spacing={-4}
                ringColor={themeColors.background.tertiary}
              />
              {providerCount > MAX_PATH_VENUE_ICONS && (
                <Text sm secondary>
                  {`+${providerCount - MAX_PATH_VENUE_ICONS}`}
                </Text>
              )}
              <Icon.ChevronRight
                size={16}
                color={themeColors.foreground.secondary}
              />
            </View>
          ),
        },
      ]
    : [];

  return (
    <View testID="swap-details-sheet">
      <BottomSheetHeader
        title={t("swapScreen.details.title")}
        layout="centered"
        onClose={onClose}
        closeTestID="swap-details-close"
      />
      <List
        variant="secondary"
        className="mt-[24px]"
        items={[
          {
            key: "fee",
            titleComponent: (
              <Text md secondary>
                {t("swapScreen.details.networkFee")}
              </Text>
            ),
            trailingContent: (
              <View className="flex-row items-center gap-[4px]">
                <Text md medium testID="swap-details-network-fee">
                  {networkFee}
                </Text>
                {networkFeeFiat && (
                  <Text md secondary>{`(${networkFeeFiat})`}</Text>
                )}
              </View>
            ),
          },
        ]}
      />
      {showSorobanFeeNote && (
        <View className="mt-[8px]">
          <Text sm secondary>
            {t("feeBreakdown.descriptionSoroban")}
          </Text>
        </View>
      )}
      <List
        variant="secondary"
        className="mt-[12px]"
        items={[
          {
            key: "rate",
            titleComponent: (
              <Text md secondary>
                {t("swapScreen.details.rate")}
              </Text>
            ),
            trailingContent: (
              <Text md medium testID="swap-details-rate">
                {rate || "--"}
              </Text>
            ),
          },
          ...routeRow,
        ]}
      />
      <View className="mt-[12px]">
        <Text sm secondary>
          {t("swapScreen.details.footer")}
        </Text>
      </View>
    </View>
  );
};
