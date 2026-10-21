import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { PinnedBottomSheetHeader } from "components/BottomSheetHeader";
import UnhideButton from "components/UnhideButton";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback } from "react";
import { View } from "react-native";

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

interface HiddenItemsBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  title: string;
  /** Shown in place of the list when there is nothing hidden */
  emptyText: string;
  items: HiddenItem[];
  onClose: () => void;
  testID?: string;
}

/**
 * The "Hidden tokens" and "Hidden collectibles" bottom sheet: a title row with
 * a close icon, one row per hidden item with an Unhide button, an empty state
 * when nothing is hidden, and a Close button.
 *
 * Uses the wrapper's scrollable mode, like connected apps: the title row and
 * the Close button are pinned, and the list between them scrolls once the
 * sheet reaches its maximum height.
 */
export const HiddenItemsBottomSheet: React.FC<HiddenItemsBottomSheetProps> = ({
  modalRef,
  title,
  emptyText,
  items,
  onClose,
  testID = "hidden-items-sheet",
}) => {
  const { t } = useAppTranslation();

  // Pinned above the list, so it needs an opaque background.
  const renderHeader = useCallback(
    () => (
      <PinnedBottomSheetHeader
        title={title}
        onClose={onClose}
        closeTestID={`${testID}-close-icon`}
      />
    ),
    [title, onClose, testID],
  );

  const renderFooter = useCallback(
    () => (
      <View
        className="bg-background-primary px-6 pt-[24px]"
        style={{ paddingBottom: pxValue(DEFAULT_PADDING) }}
      >
        <Button secondary xl isFullWidth onPress={onClose}>
          {t("common.close")}
        </Button>
      </View>
    ),
    [onClose, t],
  );

  return (
    <BottomSheet
      modalRef={modalRef}
      scrollable
      scrollViewHeaderComponent={renderHeader}
      scrollViewFooterComponent={renderFooter}
      customContent={
        <View testID={testID}>
          {items.length > 0 ? (
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
          ) : (
            <View className="py-4 items-center" testID={`${testID}-empty`}>
              <Text md secondary textAlign="center">
                {emptyText}
              </Text>
            </View>
          )}
        </View>
      }
    />
  );
};

export default HiddenItemsBottomSheet;
