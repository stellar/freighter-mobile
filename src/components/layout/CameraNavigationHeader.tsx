import {
  CustomHeaderButton,
  DEFAULT_HEADER_BUTTON_SIZE,
} from "components/layout/CustomHeaderButton";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MIN_INSETS_TOP = 34;

const CameraNavigationHeader = ({
  headerTitle,
  headerLeft,
  headerRight,
}: {
  headerTitle?: string;
  headerLeft?: () => React.ReactNode;
  headerRight?: () => React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();

  // In case insets.top is not available, let's ensure at least 34px of top
  // padding to avoid touching issues related to the notch and the status bar
  const insetsTop = insets.top || pxValue(MIN_INSETS_TOP - DEFAULT_PADDING);
  const paddingTop = insetsTop + pxValue(DEFAULT_PADDING);

  return (
    <View
      className="absolute left-0 right-0 z-[999] flex-row justify-between items-center px-6 pb-4 bg-background-transparent"
      style={{ paddingTop }}
    >
      {headerLeft ? headerLeft() : <CustomHeaderButton position="left" />}
      {typeof headerTitle === "string" && (
        <Text md primary semiBold>
          {headerTitle}
        </Text>
      )}
      {headerRight ? (
        headerRight()
      ) : (
        // Need to leave this empty view here to maintain the correct alignment of the header title
        <View className={DEFAULT_HEADER_BUTTON_SIZE} />
      )}
    </View>
  );
};

export default CameraNavigationHeader;
