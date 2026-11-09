import { act, renderHook } from "@testing-library/react-native";
import { useScrollUnderHeader } from "hooks/useScrollUnderHeader";
import * as RN from "react-native";

// Home's and History's lists run under a header floating over them: their
// content starts below it, and so does the pull-to-refresh spinner.
describe("useScrollUnderHeader", () => {
  afterEach(() => jest.restoreAllMocks());

  describe("on iOS", () => {
    beforeEach(() => jest.replaceProperty(RN.Platform, "OS", "ios"));

    it("insets the content by the header, so UIKit puts the spinner right below it", () => {
      // React Native's progressViewOffset shifts the iOS refresh control's
      // bounds, which draws its spinner outside the strip the pull opens.
      const { result } = renderHook(() => useScrollUnderHeader(126));

      expect(result.current.scrollViewProps).toMatchObject({
        contentInset: { top: 126 },
        contentOffset: { x: 0, y: -126 },
        automaticallyAdjustContentInsets: false,
      });
      expect(result.current.progressViewOffset).toBeUndefined();
      expect(result.current.fillStyle).not.toHaveProperty("paddingTop");
    });

    it("fills the viewport less the inset, which already adds to the content's height", () => {
      const { result } = renderHook(() => useScrollUnderHeader(126));

      act(() => {
        result.current.scrollViewProps.onLayout?.({
          nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } },
        } as RN.LayoutChangeEvent);
      });

      // flexGrow would fill the whole viewport and, with the inset, leave
      // content that should fit scrollable by the header's height.
      expect(result.current.fillStyle).toEqual({
        flexGrow: 0,
        minHeight: 874 - 126,
      });
    });

    it("guesses the window's height before the list lays out", () => {
      const { result } = renderHook(() => useScrollUnderHeader(126));

      expect(result.current.fillStyle).toEqual({
        flexGrow: 0,
        minHeight: RN.Dimensions.get("window").height - 126,
      });
    });

    it("moves the content with the header when the header's height changes", () => {
      // A banner under Home's bar makes the header taller after mount.
      const { result, rerender } = renderHook(
        ({ height }: { height: number }) => useScrollUnderHeader(height),
        { initialProps: { height: 126 } },
      );

      rerender({ height: 170 });

      expect(result.current.scrollViewProps).toMatchObject({
        contentInset: { top: 170 },
        contentOffset: { x: 0, y: -170 },
      });
    });
  });

  describe("on Android", () => {
    beforeEach(() => jest.replaceProperty(RN.Platform, "OS", "android"));

    it("pads the content by the header and offsets the spinner by it", () => {
      const { result } = renderHook(() => useScrollUnderHeader(110));

      expect(result.current.fillStyle).toEqual({
        flexGrow: 1,
        paddingTop: 110,
      });
      expect(result.current.progressViewOffset).toBe(110);
      expect(result.current.scrollViewProps).toEqual({});
    });
  });
});
