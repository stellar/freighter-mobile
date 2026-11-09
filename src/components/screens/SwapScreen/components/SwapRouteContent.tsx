import { BottomSheetHeader } from "components/BottomSheetHeader";
import { TokenIcon } from "components/TokenIcon";
import {
  SwapVenueIcon,
  SwapVenueIconStack,
} from "components/screens/SwapScreen/components/SwapVenueIcon";
import {
  MAX_PATH_VENUE_ICONS,
  SwapRoutePathView,
  SwapRouteToken,
  SwapRouteView,
} from "components/screens/SwapScreen/helpers";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";

const RouteTokenLabel: React.FC<{ token: SwapRouteToken }> = ({ token }) => (
  <View className="flex-row items-center gap-[8px]">
    <TokenIcon token={token.token} iconUrl={token.iconUrl} size="md" />
    <Text lg semiBold>
      {token.code}
    </Text>
  </View>
);

const PathSteps: React.FC<{ path: SwapRoutePathView; testID: string }> = ({
  path,
  testID,
}) => {
  const { themeColors } = useColors();

  return (
    <View
      className="rounded-[12px] bg-background-primary p-[16px] mx-[16px] mb-[16px]"
      testID={testID}
    >
      {path.tokens.map((token, index) => {
        const venue = path.hopVenues[index];
        return (
          // eslint-disable-next-line react/no-array-index-key
          <View key={`${token.assetId}-${index}`}>
            <View className="flex-row items-center gap-[8px]">
              <TokenIcon
                token={token.token}
                iconUrl={token.iconUrl}
                size="md"
              />
              <Text md semiBold>
                {token.code}
              </Text>
            </View>
            {venue && (
              <View className="flex-row items-center py-[8px]">
                <View className="w-[32px] items-center self-stretch">
                  <View
                    className="w-[1px] flex-1"
                    style={{ backgroundColor: themeColors.border.primary }}
                  />
                </View>
                <View className="flex-row items-center gap-[6px] ml-[8px]">
                  <SwapVenueIcon venue={venue} size={20} />
                  <Text sm secondary>
                    {venue.name}
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const PathRow: React.FC<{
  path: SwapRoutePathView;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ path, index, isExpanded, onToggle }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const visibleVenues = path.hopVenues.slice(0, MAX_PATH_VENUE_ICONS);
  const overflow = path.hopVenues.length - visibleVenues.length;
  const Chevron = isExpanded ? Icon.ChevronUp : Icon.ChevronDown;

  return (
    <View className="border-t border-border-primary">
      <TouchableOpacity
        onPress={onToggle}
        className="flex-row items-center px-[16px] py-[16px] gap-[12px]"
        accessibilityState={{ expanded: isExpanded }}
        testID={`swap-route-path-${index}`}
      >
        {path.share && (
          <View className="rounded-full bg-navy-3 px-[10px] py-[2px]">
            <Text sm medium color={themeColors.navy[11]}>
              {path.share}
            </Text>
          </View>
        )}
        <View className="flex-row items-center gap-[8px] flex-1">
          <SwapVenueIconStack venues={visibleVenues} size={28} spacing={4} />
          {overflow > 0 && <Text sm secondary>{`+${overflow}`}</Text>}
        </View>
        {path.poolCount !== null && (
          <Text sm secondary testID={`swap-route-path-${index}-pools`}>
            {path.poolCount === 1
              ? t("swapScreen.route.onePool")
              : t("swapScreen.route.pools", { count: path.poolCount })}
          </Text>
        )}
        <Chevron size={16} color={themeColors.foreground.secondary} />
      </TouchableOpacity>
      {isExpanded && (
        <PathSteps path={path} testID={`swap-route-path-${index}-steps`} />
      )}
    </View>
  );
};

export interface SwapRouteContentProps {
  routeView: SwapRouteView;
  onBack: () => void;
  onClose: () => void;
}

export const SwapRouteContent: React.FC<SwapRouteContentProps> = ({
  routeView,
  onBack,
  onClose,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const pathCount = routeView.paths.length;

  const toggle = (index: number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  return (
    <View testID="swap-route-sheet">
      <BottomSheetHeader
        title={t("swapScreen.route.title")}
        layout="centered"
        onBack={onBack}
        backTestID="swap-route-back"
        onClose={onClose}
        closeTestID="swap-route-close"
      />
      <View className="mt-[24px] rounded-[16px] bg-background-tertiary overflow-hidden">
        <View className="items-center gap-[8px] p-[16px]">
          <View className="flex-row items-center gap-[12px]">
            <RouteTokenLabel token={routeView.from} />
            <Icon.ArrowRight size={16} color={themeColors.text.primary} />
            <RouteTokenLabel token={routeView.to} />
          </View>
          <Text sm secondary testID="swap-route-path-count">
            {pathCount === 1
              ? t("swapScreen.route.onePath")
              : t("swapScreen.route.splitAcross", { count: pathCount })}
          </Text>
        </View>
        {routeView.paths.map((path, index) => (
          <PathRow
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            path={path}
            index={index}
            isExpanded={expanded.has(index)}
            onToggle={() => toggle(index)}
          />
        ))}
      </View>
      <View className="mt-[16px] pb-[16px] border-b border-border-primary">
        <Text sm secondary>
          {t("swapScreen.route.hint")}
        </Text>
      </View>
      <View className="mt-[16px] gap-[8px]">
        <Text sm secondary>
          {t("swapScreen.route.providers")}
        </Text>
        <View className="flex-row flex-wrap gap-[8px]">
          {routeView.providers.map((venue) => (
            <View
              key={venue.name}
              className="flex-row items-center gap-[6px] rounded-full bg-background-tertiary pl-[4px] pr-[10px] py-[4px]"
              testID="swap-route-provider"
            >
              <SwapVenueIcon venue={venue} size={20} />
              <Text sm medium>
                {venue.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};
