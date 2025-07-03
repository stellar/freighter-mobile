import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProps,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { BottomSheetViewProps } from "@gorhom/bottom-sheet/lib/typescript/components/bottomSheetView/types";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React, { useCallback } from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Icons = {
  Assets: {
    icon: "Coins01",
    color: "mint",
  },
  Announcement: {
    icon: "Announcement01",
    color: "lime",
  },
  Danger: {
    icon: "AlertTriangle",
    color: "red",
  },
  Wallet: {
    icon: "Wallet01",
    color: "gold",
  },
} as const;

type BottomSheetProps = {
  title?: string;
  description?: string;
  modalRef: React.RefObject<BottomSheetModal | null>;
  handleCloseModal?: () => void;
  icon?: keyof typeof Icons;
  customContent?: React.ReactNode;
  bottomSheetModalProps?: Partial<BottomSheetModalProps>;
  bottomSheetViewProps?: Partial<BottomSheetViewProps>;
  shouldCloseOnPressBackdrop?: boolean;
  snapPoints?: string[];
  enablePanDownToClose?: boolean;
  enableContentPanningGesture?: boolean;
  enableDynamicSizing?: boolean;
  useInsetsBottomPadding?: boolean;
};

const BottomSheet: React.FC<BottomSheetProps> = ({
  title,
  description,
  modalRef,
  handleCloseModal,
  icon,
  customContent,
  bottomSheetModalProps,
  bottomSheetViewProps,
  shouldCloseOnPressBackdrop = true,
  snapPoints,
  enablePanDownToClose = true,
  enableContentPanningGesture = true,
  enableDynamicSizing = true,
  useInsetsBottomPadding = true,
}) => {
  const { themeColors } = useColors();
  const IconData = icon ? Icons[icon] : null;
  const insets = useSafeAreaInsets();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        pressBehavior={shouldCloseOnPressBackdrop ? "close" : "none"}
        appearsOnIndex={0}
        opacity={0.9}
      />
    ),
    [shouldCloseOnPressBackdrop],
  );

  const renderHandle = useCallback(
    () => (
      <View className="bg-background-primary w-full items-center justify-center pt-2 rounded-t-3xl rounded-tr-3xl">
        <View className="h-[6px] w-[40px] rounded-full bg-gray-8 opacity-[.32]" />
      </View>
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={enableContentPanningGesture}
      enableDynamicSizing={enableDynamicSizing}
      snapPoints={snapPoints}
      enableOverDrag={false}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      backgroundStyle={{
        backgroundColor: themeColors.background.primary,
      }}
      {...bottomSheetModalProps}
    >
      <BottomSheetView
        className="flex-1 bg-background-primary pl-6 pr-6 pt-6 gap-6"
        style={{
          paddingBottom: useInsetsBottomPadding
            ? insets.bottom + pxValue(DEFAULT_PADDING)
            : 0,
        }}
        {...bottomSheetViewProps}
      >
        {customContent || (
          <>
            {IconData && (
              <View className="flex-row items-center justify-between">
                <View>
                  {React.createElement(Icon[IconData.icon], {
                    size: 25,
                    themeColor: IconData.color,
                    withBackground: true,
                  })}
                </View>
                <TouchableOpacity onPress={handleCloseModal}>
                  <Icon.X color={themeColors.base[1]} />
                </TouchableOpacity>
              </View>
            )}
            <View className="flex-row items-center justify-between">
              <Text xl medium>
                {title}
              </Text>
              {!IconData && (
                <TouchableOpacity onPress={handleCloseModal}>
                  <Icon.X color={themeColors.base[1]} />
                </TouchableOpacity>
              )}
            </View>
            <View className="h-px bg-gray-8" />
            <Text md medium secondary>
              {description}
            </Text>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default BottomSheet;
