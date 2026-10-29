import {
  CustomHeaderButton,
  HEADER_BUTTON_BOX,
} from "components/layout/CustomHeaderButton";
import { getNavigationHeaderRowInsets } from "components/layout/CustomNavigationHeader";
import { Text } from "components/sds/Typography";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The navigation header of a camera screen. It floats over the camera
 * preview, and lays out its row exactly like CustomNavigationHeader, so its
 * buttons and title land where every other screen's do.
 */
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

  return (
    <View
      testID="camera-navigation-header"
      // No background, unlike CustomNavigationHeader's bg-base-0: this one
      // floats over the camera preview, which has to stay visible behind it.
      className="absolute left-0 right-0 z-[999] flex-row justify-between items-center"
      style={getNavigationHeaderRowInsets(insets.top)}
    >
      {headerLeft ? headerLeft() : <CustomHeaderButton position="left" />}
      {typeof headerTitle === "string" && (
        <Text lg primary semiBold>
          {headerTitle}
        </Text>
      )}
      {headerRight ? (
        headerRight()
      ) : (
        // Need to leave this empty view here to maintain the correct alignment of the header title
        <View style={HEADER_BUTTON_BOX} />
      )}
    </View>
  );
};

export default CameraNavigationHeader;
