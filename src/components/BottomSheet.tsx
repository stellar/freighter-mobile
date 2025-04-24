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
import { calculateEdgeSpacing } from "helpers/dimensions";
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
        <View className="h-1.5 w-10 rounded-full bg-border-primary opacity-35" />
      </View>
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      enablePanDownToClose
      enableDynamicSizing
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
          paddingBottom: calculateEdgeSpacing(insets.bottom, {
            toNumber: true,
          }) as number,
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
                  <Icon.X size={24} color={themeColors.base[1]} />
                </TouchableOpacity>
              </View>
            )}
            <View className="flex-row items-center justify-between">
              <Text xl medium>
                {title}
              </Text>
              {!IconData && (
                <TouchableOpacity onPress={handleCloseModal}>
                  <Icon.X size={24} color={themeColors.base[1]} />
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
