import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProps,
  BottomSheetView,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { BottomSheetViewProps } from "@gorhom/bottom-sheet/lib/typescript/components/bottomSheetView/types";
import { AnalyticsEvent, getScreenViewedProps } from "config/analyticsConfig";
import {
  BOTTOM_SHEET_EDGE_FADE_HEIGHT,
  BOTTOM_SHEET_FLOATING_CORNER_RADIUS,
  BOTTOM_SHEET_FLOATING_MARGIN,
  BOTTOM_SHEET_MAX_HEIGHT,
  BOTTOM_SHEET_MAX_HEIGHT_RATIO,
  DEFAULT_PADDING,
} from "config/constants";
import { BACKDROP_OPACITY } from "config/theme";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import { useKeyboardHeight } from "hooks/useKeyboardHeight";
import React, { useCallback, useId, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { track } from "services/analytics/core";
import type { AnalyticsProps } from "services/analytics/types";

/**
 * Props for the shared BottomSheet wrapper.
 *
 * Every sheet is a floating card: inset from the sides and lifted above the
 * safe area, rounded on all four corners, with no drag handle.
 *
 * **Content modes** (mutually exclusive):
 * - Default (non-scrollable): renders content inside a `BottomSheetView` with
 *   dynamic sizing. Use for short, fixed-height content.
 * - `scrollable`: renders content inside a `BottomSheetScrollView`. Required
 *   when content can overflow the sheet height. Cannot be combined with
 *   `snapPoints` — dynamic sizing is used instead.
 *
 * **Footer** (`scrollViewFooterComponent`): only valid in scrollable mode.
 * Rendered absolutely at the bottom of the sheet; a matching spacer is
 * injected into the scroll content so nothing is obscured.
 *
 * **Header** (`scrollViewHeaderComponent`): only valid in scrollable mode.
 * Rendered absolutely at the top of the sheet with a matching spacer at the start of the scroll content, so the
 * content scrolls underneath it. Use `PinnedBottomSheetHeader`, which pads
 * itself and has an opaque background.
 *
 * **Padding**: content is padded 24pt on every side. Next to a pinned header
 * or footer it adds none on that side, since those pad themselves.
 *
 * **Edge fades**: a scrollable sheet fades its content where it
 * scrolls under the pinned header or footer, or past the card's edge. Each
 * fade shows only while there is content hidden on that side.
 *
 * **Max height**: a scrollable sheet stops at `BOTTOM_SHEET_MAX_HEIGHT`, or at
 * `BOTTOM_SHEET_MAX_HEIGHT_RATIO` of the window if that's shorter, and its
 * content scrolls past that. `maxDynamicContentSize` overrides it.
 *
 * **Snap points** (`snapPoints`): fixes the sheet at explicit heights. Disables
 * dynamic sizing. Cannot be combined with `scrollable`.
 *
 * **Analytics**: pass `analyticsEvent` (and optionally `analyticsProps`) to
 * fire a single tracking event the first time the sheet is presented.
 */
export type BottomSheetProps = {
  modalRef: React.RefObject<BottomSheetModal | null>;
  customContent: React.ReactNode;
  bottomSheetModalProps?: Partial<BottomSheetModalProps>;
  bottomSheetViewProps?: Partial<BottomSheetViewProps>;
  shouldCloseOnPressBackdrop?: boolean;
  snapPoints?: string[];
  enablePanDownToClose?: boolean;
  enableContentPanningGesture?: boolean;
  enableDynamicSizing?: boolean;
  maxDynamicContentSize?: number;
  analyticsEvent?: AnalyticsEvent;
  analyticsProps?: AnalyticsProps;
  scrollViewFooterComponent?: () => React.ReactNode;
  scrollViewHeaderComponent?: () => React.ReactNode;
  /**
   * Whether the pinned footer lifts above the keyboard (default). Disable
   * when the keyboard belongs to an overlay (e.g. a modal on top of the
   * sheet) so the footer stays stuck to the bottom instead of jumping.
   */
  scrollViewFooterAvoidsKeyboard?: boolean;
  scrollable?: boolean;
};

/**
 * A strip that fades from the sheet's background to transparent, laid over
 * the scroll content where it meets a pinned header or footer or the card's
 * edge. `edge` is the side the background color sits on.
 */
const EdgeFade: React.FC<{
  edge: "top" | "bottom";
  offset: number;
  color: string;
  visible: boolean;
}> = ({ edge, offset, color, visible }) => {
  // Each sheet draws two fades, and several sheets can be mounted at once.
  const gradientId = `bottom-sheet-fade-${useId().replace(/:/g, "")}`;

  return (
    <View
      testID={`bottom-sheet-edge-fade-${edge}`}
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: BOTTOM_SHEET_EDGE_FADE_HEIGHT,
        [edge]: offset,
        opacity: visible ? 1 : 0,
      }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient
            id={gradientId}
            x1="0"
            y1={edge === "top" ? "0" : "1"}
            x2="0"
            y2={edge === "top" ? "1" : "0"}
          >
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
};

const BottomSheet: React.FC<BottomSheetProps> = ({
  modalRef,
  customContent,
  bottomSheetModalProps,
  bottomSheetViewProps,
  shouldCloseOnPressBackdrop = true,
  snapPoints,
  enablePanDownToClose = true,
  enableContentPanningGesture = true,
  enableDynamicSizing = true,
  maxDynamicContentSize,
  analyticsEvent,
  analyticsProps,
  scrollViewFooterComponent = undefined,
  scrollViewHeaderComponent = undefined,
  scrollViewFooterAvoidsKeyboard = true,
  scrollable = false,
}) => {
  if (__DEV__ && scrollable && snapPoints) {
    throw new Error(
      "BottomSheet: `scrollable` and `snapPoints` cannot be used together.",
    );
  }

  if (__DEV__ && scrollViewHeaderComponent && !scrollable) {
    throw new Error(
      "BottomSheet: `scrollViewHeaderComponent` is only supported in `scrollable` mode.",
    );
  }

  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [footerHeight, setFooterHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const keyboardHeight = useKeyboardHeight();
  // Which sides have content scrolled out of view, for the edge fades.
  const scrollMetrics = useRef({ offset: 0, contentHeight: 0, viewHeight: 0 });
  const [hiddenContent, setHiddenContent] = useState({
    above: false,
    below: false,
  });
  // Track bottom-sheet open exactly once per presentation
  const hasTrackedRef = useRef(false);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        pressBehavior={shouldCloseOnPressBackdrop ? "close" : "none"}
        appearsOnIndex={0}
        opacity={BACKDROP_OPACITY}
      />
    ),
    [shouldCloseOnPressBackdrop],
  );

  const handleChange = useCallback(
    (index: number) => {
      // index >= 0 means sheet is visible
      if (analyticsEvent && index >= 0 && !hasTrackedRef.current) {
        // Screens presented via a bottom sheet are screen loads too: retarget
        // any catalogued screen-view analyticsEvent to the single canonical
        // `screen.viewed` event. Non-screen events pass through unchanged.
        const screenViewedProps = getScreenViewedProps(analyticsEvent);
        if (screenViewedProps) {
          track(AnalyticsEvent.SCREEN_VIEWED, {
            ...screenViewedProps,
            ...analyticsProps,
          });
        } else {
          track(analyticsEvent, analyticsProps);
        }
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

  const handleFooterLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const { height } = event.nativeEvent.layout;
      // iOS reports onLayout sub-pixel heights (e.g. 187.333 vs
      // 187.666) that flip on every re-render. Setting state every
      // time would loop forever — bail when the change is smaller
      // than one pixel.
      setFooterHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
    },
    [],
  );

  const handleHeaderLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const { height } = event.nativeEvent.layout;
      // Same sub-pixel guard as handleFooterLayout.
      setHeaderHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
    },
    [],
  );

  // A pinned header or footer pads itself, so the content next to it adds no
  // padding on that side, or the gap between them doubles. The card already
  // clears the safe area, so the bottom padding doesn't add insets.bottom.
  const contentPaddingTop =
    scrollable && scrollViewHeaderComponent ? 0 : pxValue(DEFAULT_PADDING);
  const contentPaddingBottom =
    scrollable && scrollViewFooterComponent ? 0 : pxValue(DEFAULT_PADDING);

  const updateHiddenContent = useCallback(() => {
    const { offset, contentHeight, viewHeight } = scrollMetrics.current;
    // A pixel of slack absorbs sub-pixel offsets at either end.
    const above = offset > 1;
    const below = viewHeight > 0 && offset + viewHeight < contentHeight - 1;
    setHiddenContent((prev) =>
      prev.above === above && prev.below === below ? prev : { above, below },
    );
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      scrollMetrics.current = {
        offset: contentOffset.y,
        contentHeight: contentSize.height,
        viewHeight: layoutMeasurement.height,
      };
      updateHiddenContent();
    },
    [updateHiddenContent],
  );

  const handleScrollContentSizeChange = useCallback(
    (_width: number, height: number) => {
      scrollMetrics.current.contentHeight = height;
      updateHiddenContent();
    },
    [updateHiddenContent],
  );

  const handleScrollViewLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scrollMetrics.current.viewHeight = event.nativeEvent.layout.height;
      updateHiddenContent();
    },
    [updateHiddenContent],
  );

  const footerBottom =
    scrollViewFooterAvoidsKeyboard && keyboardHeight > 0
      ? keyboardHeight - insets.bottom
      : 0;

  const resolvedMaxDynamicContentSize =
    maxDynamicContentSize ??
    (scrollable
      ? Math.min(
          BOTTOM_SHEET_MAX_HEIGHT,
          windowHeight * BOTTOM_SHEET_MAX_HEIGHT_RATIO,
        )
      : undefined);

  const fixedContent = (
    <BottomSheetView
      className="pl-6 pr-6 pt-6 gap-6"
      style={{
        paddingBottom: contentPaddingBottom,
      }}
      {...bottomSheetViewProps}
    >
      {customContent}
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
  );

  return (
    <>
      {/* Pre-measurement render — kept off-screen and out of the
          BottomSheetModal so the footer's onLayout fires DURING the
          wrapper's mount, not during the open animation. With
          footerHeight set up-front, the in-modal spacer is already
          correctly sized on the first render after .present(), and
          BottomSheetModal's dynamic-sizing measures the full content
          once. Without this, footer onLayout used to fire mid-open,
          mutating the scroll content size and triggering a
          re-measure + re-animate — visible as a first-render glitch on
          Android. The actual user-facing footer is still rendered
          inside the modal below; this one is purely a measure probe. */}
      {scrollable && scrollViewFooterComponent && (
        <View
          style={{
            position: "absolute",
            top: -4000,
            left: 0,
            right: 0,
            opacity: 0,
          }}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={handleFooterLayout}
        >
          {scrollViewFooterComponent()}
        </View>
      )}
      {/* Same pre-measurement pattern for the pinned header (see above). */}
      {scrollable && scrollViewHeaderComponent && (
        <View
          style={{
            position: "absolute",
            top: -4000,
            left: 0,
            right: 0,
            opacity: 0,
          }}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={handleHeaderLayout}
        >
          {scrollViewHeaderComponent()}
        </View>
      )}
      <BottomSheetModal
        ref={modalRef}
        enablePanDownToClose={enablePanDownToClose}
        enableContentPanningGesture={enableContentPanningGesture}
        enableDynamicSizing={enableDynamicSizing}
        maxDynamicContentSize={resolvedMaxDynamicContentSize}
        enableOverDrag={false}
        snapPoints={snapPoints}
        topInset={scrollable ? insets.top : undefined}
        detached
        bottomInset={insets.bottom + BOTTOM_SHEET_FLOATING_MARGIN}
        // Clip the sheet to the card shape. gorhom doesn't clip detached content,
        // so it would show past the rounded corners.
        style={{
          marginHorizontal: BOTTOM_SHEET_FLOATING_MARGIN,
          borderRadius: BOTTOM_SHEET_FLOATING_CORNER_RADIUS,
          overflow: "hidden",
        }}
        backdropComponent={renderBackdrop}
        handleComponent={null}
        backgroundStyle={{
          backgroundColor: themeColors.background.primary,
          borderRadius: BOTTOM_SHEET_FLOATING_CORNER_RADIUS,
        }}
        {...bottomSheetModalProps}
        onChange={handleChange}
      >
        {scrollable ? (
          <View>
            <BottomSheetScrollView
              className="pl-6 pr-6 gap-6"
              showsVerticalScrollIndicator={false}
              // gorhom sizes the sheet from the scroll content's height, so
              // padding on the scroll view itself isn't counted and the card
              // comes out short. Pad the content instead.
              contentContainerStyle={{
                paddingTop: contentPaddingTop,
                paddingBottom: contentPaddingBottom,
              }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={handleScrollContentSizeChange}
              onLayout={handleScrollViewLayout}
              {...bottomSheetViewProps}
            >
              {/* Spacer reserves room for the absolutely-positioned pinned
                  header below, mirroring the footer spacer. */}
              {scrollViewHeaderComponent && headerHeight > 0 && (
                <View style={{ height: headerHeight }} />
              )}
              {customContent}
              {/* Spacer reserves room for the absolutely-positioned footer
                  below. Sized from the out-of-modal pre-measurement
                  above so it's already correct on first render. Guarded by
                  `scrollViewFooterComponent` (like the overlay below) so a
                  stale `footerHeight` from a previously-rendered footer
                  doesn't leave a phantom gap once the footer is removed. */}
              {scrollViewFooterComponent && footerHeight > 0 && (
                <View style={{ height: footerHeight }} />
              )}
            </BottomSheetScrollView>
            {scrollViewHeaderComponent && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                }}
              >
                {scrollViewHeaderComponent()}
              </View>
            )}
            {scrollViewFooterComponent && (
              <View
                testID="bottom-sheet-scroll-footer"
                style={{
                  position: "absolute",
                  bottom: footerBottom,
                  left: 0,
                  right: 0,
                  // Round and clip the footer so its background doesn't square off
                  // the card's bottom corners.
                  borderBottomLeftRadius: BOTTOM_SHEET_FLOATING_CORNER_RADIUS,
                  borderBottomRightRadius: BOTTOM_SHEET_FLOATING_CORNER_RADIUS,
                  overflow: "hidden",
                }}
              >
                {scrollViewFooterComponent()}
              </View>
            )}
            <EdgeFade
              edge="top"
              offset={scrollViewHeaderComponent ? headerHeight : 0}
              color={themeColors.background.primary}
              visible={hiddenContent.above}
            />
            <EdgeFade
              edge="bottom"
              offset={
                scrollViewFooterComponent ? footerBottom + footerHeight : 0
              }
              color={themeColors.background.primary}
              visible={hiddenContent.below}
            />
          </View>
        ) : (
          fixedContent
        )}
      </BottomSheetModal>
    </>
  );
};

export default BottomSheet;
