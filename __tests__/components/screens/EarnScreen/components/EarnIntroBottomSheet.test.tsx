import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent } from "@testing-library/react-native";
import { EarnIntroBottomSheet } from "components/screens/EarnScreen/components/EarnIntroBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const makeRef = (dismissMock: jest.Mock) => {
  const ref = React.createRef<BottomSheetModal>();
  Object.defineProperty(ref, "current", {
    value: { dismiss: dismissMock },
    writable: true,
  });
  return ref;
};

describe("EarnIntroBottomSheet", () => {
  it("renders the extension's verbatim copy", () => {
    const { getByText } = renderWithProviders(
      <EarnIntroBottomSheet onDismiss={jest.fn()} />,
    );

    expect(getByText("Make your tokens earn for you")).toBeTruthy();
    expect(
      getByText(
        "Deposit supported tokens into DeFi pools and start earning rewards.",
      ),
    ).toBeTruthy();
    expect(getByText("Start earning")).toBeTruthy();
  });

  it("dismisses via the forwarded ref and marks the intro seen when the CTA is pressed", () => {
    const dismissMock = jest.fn();
    const onDismiss = jest.fn();
    const ref = makeRef(dismissMock);

    const { getByTestId } = renderWithProviders(
      <EarnIntroBottomSheet bottomSheetModalRef={ref} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId("earn-intro-start"));

    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses via the forwarded ref and marks the intro seen when the close control is pressed", () => {
    const dismissMock = jest.fn();
    const onDismiss = jest.fn();
    const ref = makeRef(dismissMock);

    const { getByTestId } = renderWithProviders(
      <EarnIntroBottomSheet bottomSheetModalRef={ref} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId("earn-intro-close"));

    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
