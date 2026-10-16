import UnhideButton from "components/UnhideButton";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

/**
 * Share of the window height the row list may take before it scrolls, so
 * the title and Close button stay on screen with many hidden items. Applied
 * in points: the sheet sizes itself to its content, so a percentage would
 * have no screen-sized parent to resolve against.
 */
export const LIST_MAX_HEIGHT_RATIO = 0.5;

export interface HiddenItem {
  /** Stable key for the row */
  id: string;
  /** Leading visual, usually the token icon or collectible thumbnail */
  leading: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Whether this row's unhide is in flight */
  isUnhiding?: boolean;
  onUnhide: () => void;
}

interface HiddenItemsSheetContentProps {
  title: string;
  /** Shown in place of the list when there is nothing hidden */
  emptyText: string;
  items: HiddenItem[];
  onClose: () => void;
  testID?: string;
}

/**
 * Body of the "Hidden tokens" and "Hidden collectibles" bottom sheets: a
 * title row with a close icon, one row per hidden item with an Unhide button,
 * an empty state when nothing is hidden, and a Close button.
 *
 * Render it in a sheet with `enableContentPanningGesture={false}`: otherwise
 * the sheet takes drags meant for the list (mainly on Android) and moves
 * instead of scrolling.
 */
export const HiddenItemsSheetContent: React.FC<
  HiddenItemsSheetContentProps
> = ({ title, emptyText, items, onClose, testID = "hidden-items-sheet" }) => {
  const { t } = useAppTranslation();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <View className="gap-6" testID={testID}>
      <View className="flex-row justify-between items-center">
        <Text xl medium>
          {title}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={8}
          testID={`${testID}-close-icon`}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        >
          <Icon.X withBackground themeColor="gray" />
        </TouchableOpacity>
      </View>
      {items.length > 0 ? (
        <ScrollView
          style={{ maxHeight: windowHeight * LIST_MAX_HEIGHT_RATIO }}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          <View className="gap-4">
            {items.map((item) => (
              <View
                key={item.id}
                className="flex-row justify-between items-center"
                testID={`${testID}-row-${item.id}`}
              >
                <View className="flex-row items-center flex-1 mr-2">
                  {item.leading}
                  <View className="ml-4 flex-1">
                    <Text md primary medium numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text sm secondary medium numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <UnhideButton
                  onPress={item.onUnhide}
                  isLoading={item.isUnhiding}
                  testID={`${testID}-unhide-${item.id}`}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="py-4 items-center" testID={`${testID}-empty`}>
          <Text md secondary textAlign="center">
            {emptyText}
          </Text>
        </View>
      )}
      <Button secondary xl isFullWidth onPress={onClose}>
        {t("common.close")}
      </Button>
    </View>
  );
};

export default HiddenItemsSheetContent;
