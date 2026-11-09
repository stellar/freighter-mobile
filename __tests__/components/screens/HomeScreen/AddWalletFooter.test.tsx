import { fireEvent } from "@testing-library/react-native";
import AddWalletFooter from "components/screens/HomeScreen/AddWalletFooter";
import { colors } from "config/colors";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("AddWalletFooter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the add wallet label", () => {
    const { getByText } = renderWithProviders(
      <AddWalletFooter onPress={jest.fn()} />,
    );

    expect(getByText("Add wallet")).toBeTruthy();
  });

  it("labels the row in the brand color", () => {
    // Figma uses Blue/09 for the label, which is lilac[9] in code:
    // https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=694-19010
    const { getByText } = renderWithProviders(
      <AddWalletFooter onPress={jest.fn()} />,
    );

    expect(getByText("Add wallet").props.style).toMatchObject({
      color: colors.light.lilac[9],
    });
  });

  it("gives the plus its own tinted circle, a step up from the page", () => {
    // Figma uses Blue/03 (#eef4ff) for the circle, not Blue/02.
    const { toJSON } = renderWithProviders(
      <AddWalletFooter onPress={jest.fn()} />,
    );

    const classNames = (node: unknown): string[] => {
      if (Array.isArray(node)) return node.flatMap(classNames);
      if (!node || typeof node !== "object") return [];
      const el = node as {
        props?: { className?: unknown };
        children?: unknown;
      };

      return [
        ...(typeof el.props?.className === "string"
          ? [el.props.className]
          : []),
        ...classNames(el.children),
      ];
    };

    expect(classNames(toJSON()).join(" ")).toContain("bg-lilac-3");
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <AddWalletFooter onPress={onPress} />,
    );

    fireEvent.press(getByTestId("manage-accounts-add-wallet-button"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <AddWalletFooter onPress={onPress} disabled />,
    );

    fireEvent.press(getByTestId("manage-accounts-add-wallet-button"));

    expect(onPress).not.toHaveBeenCalled();
  });
});
