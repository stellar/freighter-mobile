import { render } from "@testing-library/react-native";
import BottomSheet from "components/BottomSheet";
import React from "react";
import { View } from "react-native";

// Capture the props the wrapper hands to BottomSheetModal so we can assert the
// floating contract without needing a real, presented modal.
const capturedModalProps: Record<string, any> = {};

jest.mock("@gorhom/bottom-sheet", () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const ReactActual = require("react");
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { View: RNView } = require("react-native");
  return {
    __esModule: true,
    // forwardRef's signature is (props, ref); forward the ref onto the host
    // View so React does not warn about a one-arg render function.
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

describe("BottomSheet floating variant", () => {
  const makeRef = () => React.createRef<any>();

  it("passes floating layout props to BottomSheetModal when `floating` is set", () => {
    render(
      <BottomSheet
        floating
        modalRef={makeRef()}
        customContent={<View testID="content" />}
      />,
    );

    expect(capturedModalProps.detached).toBe(true);
    // insets.bottom is mocked to 0 in jest.setup.js, so bottomInset === 0 + 8
    expect(capturedModalProps.bottomInset).toBe(8);
    expect(capturedModalProps.style).toEqual({ marginHorizontal: 8 });
    expect(capturedModalProps.backgroundStyle.borderRadius).toBe(32);
    expect(capturedModalProps.handleComponent).toBeNull();
  });

  it("keeps the classic (attached, handled) layout when `floating` is not set", () => {
    render(
      <BottomSheet
        modalRef={makeRef()}
        customContent={<View testID="content" />}
      />,
    );

    expect(capturedModalProps.detached).toBeFalsy();
    expect(capturedModalProps.bottomInset).toBeFalsy();
    expect(capturedModalProps.style).toBeFalsy();
    expect(capturedModalProps.backgroundStyle.borderRadius).toBeUndefined();
    expect(typeof capturedModalProps.handleComponent).toBe("function");
  });

  it("rounds and clips the scroll footer's bottom corners when floating", () => {
    const { getAllByTestId } = render(
      <BottomSheet
        floating
        scrollable
        modalRef={makeRef()}
        customContent={<View testID="content" />}
        scrollViewFooterComponent={() => <View testID="footer-content" />}
      />,
    );

    // Only the in-modal footer container carries the testID (the off-screen
    // pre-measurement probe does not), so there is exactly one.
    const [footer] = getAllByTestId("bottom-sheet-scroll-footer");
    expect(footer.props.style.borderBottomLeftRadius).toBe(32);
    expect(footer.props.style.borderBottomRightRadius).toBe(32);
    expect(footer.props.style.overflow).toBe("hidden");
  });

  it("leaves the scroll footer corners square when not floating", () => {
    const { getAllByTestId } = render(
      <BottomSheet
        scrollable
        modalRef={makeRef()}
        customContent={<View testID="content" />}
        scrollViewFooterComponent={() => <View testID="footer-content" />}
      />,
    );

    const [footer] = getAllByTestId("bottom-sheet-scroll-footer");
    expect(footer.props.style.borderBottomLeftRadius).toBeUndefined();
    expect(footer.props.style.overflow).toBeUndefined();
  });
});
