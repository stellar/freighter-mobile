import { act, fireEvent, render } from "@testing-library/react-native";
import BottomSheet from "components/BottomSheet";
import React from "react";
import { View } from "react-native";

// Record the props passed to BottomSheetModal so tests can check them without opening a modal.
const capturedModalProps: Record<string, any> = {};

jest.mock("@gorhom/bottom-sheet", () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const ReactActual = require("react");
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { View: RNView } = require("react-native");
  return {
    __esModule: true,
    // Forward the ref so React doesn't warn about a one-argument render function.
    BottomSheetModal: ReactActual.forwardRef((props: any, ref: any) => {
      Object.keys(capturedModalProps).forEach(
        (k) => delete capturedModalProps[k],
      );
      Object.assign(capturedModalProps, props);
      return ReactActual.createElement(RNView, { ref }, props.children);
    }),
    BottomSheetView: (props: any) =>
      ReactActual.createElement(RNView, props, props.children),
    BottomSheetScrollView: (props: any) =>
      ReactActual.createElement(RNView, props, props.children),
    BottomSheetBackdrop: () => null,
  };
});

// The window height decides the default max height. Defaults to a tall screen.
const mockUseWindowDimensions = jest.fn(() => ({
  width: 400,
  height: 956,
  scale: 3,
  fontScale: 1,
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

describe("BottomSheet floating card", () => {
  const makeRef = () => React.createRef<any>();

  it("passes the floating card layout to BottomSheetModal", () => {
    render(
      <BottomSheet
        modalRef={makeRef()}
        customContent={<View testID="content" />}
      />,
    );

    expect(capturedModalProps.detached).toBe(true);
    // insets.bottom is 0 in tests, so bottomInset is just the 8pt margin.
    expect(capturedModalProps.bottomInset).toBe(8);
    // The body is clipped so content can't show past the rounded corners.
    expect(capturedModalProps.style).toEqual({
      marginHorizontal: 8,
      borderRadius: 32,
      overflow: "hidden",
    });
    expect(capturedModalProps.backgroundStyle.borderRadius).toBe(32);
    expect(capturedModalProps.handleComponent).toBeNull();
  });

  it("rounds and clips the scroll footer's bottom corners", () => {
    const { getAllByTestId } = render(
      <BottomSheet
        scrollable
        modalRef={makeRef()}
        customContent={<View testID="content" />}
        scrollViewFooterComponent={() => <View testID="footer-content" />}
      />,
    );

    // Only the real footer has this testID, not the hidden copy used for measuring.
    const [footer] = getAllByTestId("bottom-sheet-scroll-footer");
    expect(footer.props.style.borderBottomLeftRadius).toBe(32);
    expect(footer.props.style.borderBottomRightRadius).toBe(32);
    expect(footer.props.style.overflow).toBe("hidden");
  });
});

// gorhom sizes a scrollable sheet from the scroll content's height, so padding
// on the scroll view itself isn't counted. A card padded that way comes out
// 24pt short and scrolls.
describe("BottomSheet scrollable padding", () => {
  const makeRef = () => React.createRef<any>();

  it("pads the scroll content, not the scroll view", () => {
    const { getByTestId } = render(
      <BottomSheet
        scrollable
        modalRef={makeRef()}
        customContent={<View testID="content" />}
        bottomSheetViewProps={{ testID: "sheet-scroll" }}
      />,
    );

    const scrollView = getByTestId("sheet-scroll");
    expect(scrollView.props.contentContainerStyle).toEqual({
      paddingTop: 24,
      paddingBottom: 24,
    });
    expect(scrollView.props.style).toBeUndefined();
  });

  it("leaves the bottom padding to a pinned footer", () => {
    const { getByTestId } = render(
      <BottomSheet
        scrollable
        modalRef={makeRef()}
        customContent={<View testID="content" />}
        scrollViewFooterComponent={() => <View testID="footer-content" />}
        bottomSheetViewProps={{ testID: "sheet-scroll" }}
      />,
    );

    // The footer has its own top padding, so the content adds none below it.
    expect(getByTestId("sheet-scroll").props.contentContainerStyle).toEqual({
      paddingTop: 24,
      paddingBottom: 0,
    });
  });

  it("leaves the top padding to a pinned header", () => {
    const { getByTestId } = render(
      <BottomSheet
        scrollable
        modalRef={makeRef()}
        customContent={<View testID="content" />}
        scrollViewHeaderComponent={() => <View testID="header-content" />}
        bottomSheetViewProps={{ testID: "sheet-scroll" }}
      />,
    );

    // The header has its own bottom padding, so the content adds none above it.
    expect(getByTestId("sheet-scroll").props.contentContainerStyle).toEqual({
      paddingTop: 0,
      paddingBottom: 24,
    });
  });
});

describe("BottomSheet max height", () => {
  const makeRef = () => React.createRef<any>();

  const mockWindowHeight = (height: number) => {
    mockUseWindowDimensions.mockReturnValue({
      width: 400,
      height,
      scale: 3,
      fontScale: 1,
    });
  };

  it("stops a scrollable sheet at 726pt on a tall screen", () => {
    mockWindowHeight(956);
    render(
      <BottomSheet
        scrollable
        modalRef={makeRef()}
        customContent={<View testID="content" />}
      />,
    );

    expect(capturedModalProps.maxDynamicContentSize).toBe(726);
  });

  it("stops a scrollable sheet at 83% of a short screen", () => {
    mockWindowHeight(667);
    render(
      <BottomSheet
        scrollable
        modalRef={makeRef()}
        customContent={<View testID="content" />}
      />,
    );

    expect(capturedModalProps.maxDynamicContentSize).toBeCloseTo(553.61);
  });

  it("uses the max height a sheet passes instead", () => {
    mockWindowHeight(956);
    render(
      <BottomSheet
        scrollable
        maxDynamicContentSize={400}
        modalRef={makeRef()}
        customContent={<View testID="content" />}
      />,
    );

    expect(capturedModalProps.maxDynamicContentSize).toBe(400);
  });

  it("leaves a non-scrollable sheet uncapped", () => {
    mockWindowHeight(956);
    render(
      <BottomSheet
        modalRef={makeRef()}
        customContent={<View testID="content" />}
      />,
    );

    expect(capturedModalProps.maxDynamicContentSize).toBeUndefined();
  });
});

describe("BottomSheet edge fades", () => {
  const makeRef = () => React.createRef<any>();

  const renderScrollableSheet = () =>
    render(
      <BottomSheet
        scrollable
        modalRef={makeRef()}
        customContent={<View testID="content" />}
        bottomSheetViewProps={{ testID: "sheet-scroll" }}
      />,
    );

  const scrollTo = (
    scrollView: ReturnType<ReturnType<typeof render>["getByTestId"]>,
    offset: number,
  ) =>
    act(() => {
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          contentOffset: { y: offset },
          contentSize: { height: 1000 },
          layoutMeasurement: { height: 700 },
        },
      });
    });

  const opacityOf = (
    element: ReturnType<ReturnType<typeof render>["getByTestId"]>,
  ) => element.props.style.opacity;

  it("hides both fades when the content fits", () => {
    const { getByTestId } = renderScrollableSheet();

    act(() => {
      fireEvent(getByTestId("sheet-scroll"), "layout", {
        nativeEvent: { layout: { height: 400 } },
      });
      fireEvent(getByTestId("sheet-scroll"), "contentSizeChange", 400, 400);
    });

    expect(opacityOf(getByTestId("bottom-sheet-edge-fade-top"))).toBe(0);
    expect(opacityOf(getByTestId("bottom-sheet-edge-fade-bottom"))).toBe(0);
  });

  it("fades the bottom while there is more content below", () => {
    const { getByTestId } = renderScrollableSheet();

    scrollTo(getByTestId("sheet-scroll"), 0);

    expect(opacityOf(getByTestId("bottom-sheet-edge-fade-top"))).toBe(0);
    expect(opacityOf(getByTestId("bottom-sheet-edge-fade-bottom"))).toBe(1);
  });

  it("fades both edges mid-scroll", () => {
    const { getByTestId } = renderScrollableSheet();

    scrollTo(getByTestId("sheet-scroll"), 150);

    expect(opacityOf(getByTestId("bottom-sheet-edge-fade-top"))).toBe(1);
    expect(opacityOf(getByTestId("bottom-sheet-edge-fade-bottom"))).toBe(1);
  });

  it("fades only the top at the end of the content", () => {
    const { getByTestId } = renderScrollableSheet();

    scrollTo(getByTestId("sheet-scroll"), 300);

    expect(opacityOf(getByTestId("bottom-sheet-edge-fade-top"))).toBe(1);
    expect(opacityOf(getByTestId("bottom-sheet-edge-fade-bottom"))).toBe(0);
  });
});
