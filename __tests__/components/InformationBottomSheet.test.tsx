import { fireEvent } from "@testing-library/react-native";
import InformationBottomSheet from "components/InformationBottomSheet";
import { ButtonVariants } from "components/sds/Button";
import { getButtonColors } from "components/sds/Button/theme";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const LIGHT_BUTTON_COLORS = getButtonColors("light");
const texts = [{ key: "context", value: "Some context" }];

describe("InformationBottomSheet", () => {
  it("keeps its filled confirm button by default", () => {
    const { getByTestId } = renderWithProviders(
      <InformationBottomSheet
        title="Title"
        texts={texts}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        confirmLabel="Continue"
        confirmTestID="confirm-button"
      />,
    );

    expect(getByTestId("confirm-button").props.style).toMatchObject({
      backgroundColor: LIGHT_BUTTON_COLORS.secondary.background,
    });
  });

  it("draws the confirm button in the variant it is given", () => {
    const onConfirm = jest.fn();
    const { getByTestId } = renderWithProviders(
      <InformationBottomSheet
        title="Title"
        texts={texts}
        onClose={jest.fn()}
        onConfirm={onConfirm}
        confirmLabel="Reset"
        confirmVariant={ButtonVariants.DESTRUCTIVE}
        confirmTestID="confirm-button"
      />,
    );
    const button = getByTestId("confirm-button");

    expect(button.props.style).toMatchObject({
      backgroundColor: LIGHT_BUTTON_COLORS.destructive.background,
    });

    fireEvent.press(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
