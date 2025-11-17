import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProps,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetFooter,
} from "@gorhom/bottom-sheet";
import { BottomSheetDefaultFooterProps } from "@gorhom/bottom-sheet/lib/typescript/components/bottomSheetFooter/types";
import { BottomSheetViewProps } from "@gorhom/bottom-sheet/lib/typescript/components/bottomSheetView/types";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import { useKeyboardHeight } from "hooks/useKeyboardHeight";
import React, { useCallback, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { track } from "services/analytics/core";
import type { AnalyticsProps } from "services/analytics/types";

const Icons = {
  Plus: {
    icon: "Plus",
    color: "lilac",
  },
  PlusCircle: {
    icon: "PlusCircle",
    color: "lilac",
  },
  Tokens: {
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

export type BottomSheetProps = {
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
  analyticsEvent?: AnalyticsEvent;
  analyticsProps?: AnalyticsProps;
  renderFooterComponent?: () => React.ReactNode;
  scrollable?: boolean;
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
  analyticsEvent,
  analyticsProps,
  renderFooterComponent = undefined,
  scrollable = false,
}) => {
  const { themeColors } = useColors();
  const IconData = icon ? Icons[icon] : Icons.Announcement;
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const keyboardHeight = useKeyboardHeight();
  // Track bottom-sheet open exactly once per presentation
  const hasTrackedRef = useRef(false);

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

  const handleChange = useCallback(
    (index: number) => {
      // index >= 0 means sheet is visible
      if (analyticsEvent && index >= 0 && !hasTrackedRef.current) {
        track(analyticsEvent, analyticsProps);
        hasTrackedRef.current = true;
      }

      // Call any user-supplied onChange handler (cast to allow differing signatures)
      if (bottomSheetModalProps?.onChange) {
        (bottomSheetModalProps.onChange as unknown as (idx: number) => void)(
          index,
        );
      }
    },
    [analyticsEvent, analyticsProps, bottomSheetModalProps],
  );

  const renderContent = useCallback(
    () =>
      customContent || (
        <View className="gap-4">
          {IconData && (
            <View className="flex-row items-center justify-between">
              <View className="size-10 rounded-lg items-center justify-center">
                {React.createElement(Icon[IconData.icon], {
                  themeColor: IconData.color,
                  withBackground: true,
                  square: true,
                  size: 24,
                })}
              </View>
              <TouchableOpacity
                onPress={handleCloseModal}
                className="size-10 items-center justify-center rounded-full bg-gray-3"
              >
                <Icon.X color={themeColors.gray[9]} />
              </TouchableOpacity>
            </View>
          )}
          <View>
            <Text xl medium>
              {title}
            </Text>
            {!IconData && (
              <TouchableOpacity onPress={handleCloseModal}>
                <Icon.X color={themeColors.gray[9]} />
              </TouchableOpacity>
            )}
            <View className="h-4" />
            <Text md regular secondary>
              {description}
            </Text>
          </View>
        </View>
      ),
    [
      customContent,
      IconData,
      handleCloseModal,
      themeColors.gray,
      title,
      description,
    ],
  );

  const handleFooterLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const { height } = event.nativeEvent.layout;
      setFooterHeight(height);
    },
    [],
  );

  const renderFooterWithLayout = useCallback(
    (props: BottomSheetDefaultFooterProps) => {
      if (!renderFooterComponent) return null;

      return (
        <BottomSheetFooter {...props}>
          <View onLayout={handleFooterLayout}>{renderFooterComponent()}</View>
        </BottomSheetFooter>
      );
    },
    [renderFooterComponent, handleFooterLayout],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={enableContentPanningGesture}
      enableDynamicSizing={enableDynamicSizing}
      enableOverDrag={false}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      footerComponent={renderFooterWithLayout}
      backgroundStyle={{
        backgroundColor: themeColors.background.primary,
      }}
      {...bottomSheetModalProps}
      onChange={handleChange}
    >
      {scrollable ? (
        <BottomSheetScrollView
          className="bg-background-primary pl-6 pr-6 pt-6 gap-6"
          showsVerticalScrollIndicator={false}
          style={{
            paddingBottom: useInsetsBottomPadding
              ? insets.bottom + pxValue(DEFAULT_PADDING)
              : 0,
          }}
          {...bottomSheetViewProps}
        >
          {renderContent()}
          {/* workaround to add the fother height to the bottom sheet, as it's not included as part of the library calcs */}
          {footerHeight > 0 && <View style={{ height: footerHeight }} />}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView
          className="bg-background-primary pl-6 pr-6 pt-6 gap-6"
          style={{
            paddingBottom: useInsetsBottomPadding
              ? insets.bottom + pxValue(DEFAULT_PADDING)
              : 0,
          }}
          {...bottomSheetViewProps}
        >
          {renderContent()}
          {/* 
            Workaround for BottomSheetTextInput layout issues with @gorhom/bottom-sheet.
            When the keyboard appears, BottomSheetView can shrink unexpectedly, causing
            text inputs to become unusable. This conditional rendering adds padding
            to maintain proper layout when keyboard is visible.
          */}
          {keyboardHeight > 0 && (
            <View style={{ height: keyboardHeight - insets.bottom }} />
          )}
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
};

export default BottomSheet;
