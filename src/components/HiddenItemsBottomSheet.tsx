import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { PinnedBottomSheetHeader } from "components/BottomSheetHeader";
import UnhideButton from "components/UnhideButton";
import { Text } from "components/sds/Typography";
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
 * a close icon, one row per hidden item with an Unhide button, and an empty
 * state when nothing is hidden. The close icon is the only way to dismiss it;
 * the Varial sheet design has no Close button.
 *
 * Uses the wrapper's scrollable mode, like connected apps: the title row is
 * pinned, and the list under it scrolls once the sheet reaches its maximum
 * height.
 */
export const HiddenItemsBottomSheet: React.FC<HiddenItemsBottomSheetProps> = ({
  modalRef,
  title,
  emptyText,
  items,
  onClose,
  testID = "hidden-items-sheet",
}) => {
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

  return (
    <BottomSheet
      modalRef={modalRef}
      scrollable
      scrollViewHeaderComponent={renderHeader}
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
