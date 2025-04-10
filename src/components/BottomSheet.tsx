import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { getColor } from "config/colors";
import { THEME } from "config/theme";
import { pxValue } from "helpers/dimensions";
import { colorScheme } from "nativewind";
import React, { useCallback } from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Icons = {
  Assets: "Assets",
  Announcement: "Announcement",
  Danger: "Danger",
  Wallet: "Wallet",
};

type BottomSheetProps = {
  title: string;
  description: string;
  modalRef: React.RefObject<BottomSheetModal | null>;
  handleCloseModal?: () => void;
  icon?: keyof typeof Icons;
  customContent?: React.ReactNode;
};

const BottomSheet: React.FC<BottomSheetProps> = ({
  title,
  description,
  modalRef,
  handleCloseModal,
  icon,
  customContent,
}) => {
  const theme = colorScheme.get() ?? "dark";

  const MapIcons = {
    [Icons.Assets]: {
      IconComponent: Icon.Coins01,
      iconColor: getColor(theme, "mint", 9),
      backgroundColorClassName: "bg-mint-3",
    },
    [Icons.Announcement]: {
      IconComponent: Icon.Announcement01,
      iconColor: getColor(theme, "lime", 9),
      backgroundColorClassName: "bg-lime-3",
    },
    [Icons.Danger]: {
      IconComponent: Icon.AlertTriangle,
      iconColor: getColor(theme, "red", 9),
      backgroundColorClassName: "bg-red-3",
    },
    [Icons.Wallet]: {
      IconComponent: Icon.Wallet01,
      iconColor: getColor(theme, "gold", 9),
      backgroundColorClassName: "bg-gold-3",
    },
  };
  const IconData = icon ? MapIcons[icon] : null;
  const insets = useSafeAreaInsets();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    [],
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
      enableOverDrag={false}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
    >
      <BottomSheetView
        className="flex-1 bg-background-primary pl-6 pr-6 pt-6 gap-6"
        style={{
          paddingBottom: insets.bottom,
        }}
      >
        {customContent || (
          <>
            {IconData && (
              <View className="flex-row items-center justify-between">
                <View
                  className={`rounded-full p-2 self-start ${IconData.backgroundColorClassName}`}
                >
                  <IconData.IconComponent
                    size={pxValue(25)}
                    color={IconData.iconColor}
                  />
                </View>
                <TouchableOpacity onPress={handleCloseModal}>
                  <Icon.X
                    size={pxValue(24)}
                    color={THEME.colors.base.secondary}
                  />
                </TouchableOpacity>
              </View>
            )}
            <View className="flex-row items-center justify-between">
              <Text xl weight="medium">
                {title}
              </Text>
              {!IconData && (
                <TouchableOpacity onPress={handleCloseModal}>
                  <Icon.X
                    size={pxValue(24)}
                    color={THEME.colors.base.secondary}
                  />
                </TouchableOpacity>
              )}
            </View>
            <View className="h-px bg-gray-8" />
            <Text md weight="medium" color={THEME.colors.text.secondary}>
              {description}
            </Text>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default BottomSheet;
