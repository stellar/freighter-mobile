import { useCallback, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  ScrollViewProps,
  ViewStyle,
  useWindowDimensions,
} from "react-native";

interface ScrollUnderHeader {
  /** Spread onto the scroll view (or list). */
  scrollViewProps: Pick<
    ScrollViewProps,
    | "contentInset"
    | "contentOffset"
    | "automaticallyAdjustContentInsets"
    | "onLayout"
  >;
  /**
   * For the content container, in place of `flexGrow: 1`: it starts the
   * content below the header and fills the rest of the viewport.
   */
  fillStyle: ViewStyle;
  /** For the RefreshControl. */
  progressViewOffset: number | undefined;
}

/**
 * Props for a scroll view that runs under a header floating over it (Home's
 * and History's): its content starts below the header, and so does its
 * pull-to-refresh spinner.
 *
 * - iOS takes the header's height as a content inset. React Native's
 *   `progressViewOffset` shifts the native refresh control's bounds there,
 *   which draws the spinner outside the strip the pull opens: the gap showed
 *   with no spinner in it. With the inset, UIKit puts the control right below
 *   the header. The inset adds to the content's height, so content that
 *   should fill the viewport takes the viewport's height less the inset.
 * - Android pads the content instead, and `progressViewOffset` moves its
 *   spinner below the header.
 */
export const useScrollUnderHeader = (
  headerHeight: number,
): ScrollUnderHeader => {
  const { height: windowHeight } = useWindowDimensions();
  // These lists run from the screen's top to its bottom, so the window's
  // height is the viewport's until the list lays out.
  const [viewportHeight, setViewportHeight] = useState(windowHeight);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  }, []);

  if (Platform.OS === "ios") {
    return {
      scrollViewProps: {
        contentInset: { top: headerHeight },
        // Starts at the top, and moves with the inset when the header's
        // height changes, as a banner under Home's bar does.
        contentOffset: { x: 0, y: -headerHeight },
        automaticallyAdjustContentInsets: false,
        onLayout,
      },
      // flexGrow is off even where a caller sets it before this: it would
      // fill the whole viewport and, with the inset, leave content that
      // fits scrollable by the header's height.
      fillStyle: {
        flexGrow: 0,
        minHeight: Math.max(viewportHeight - headerHeight, 0),
      },
      progressViewOffset: undefined,
    };
  }

  return {
    scrollViewProps: {},
    fillStyle: { flexGrow: 1, paddingTop: headerHeight },
    progressViewOffset: headerHeight,
  };
};
