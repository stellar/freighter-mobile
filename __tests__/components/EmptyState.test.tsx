import { fireEvent } from "@testing-library/react-native";
import { EmptyState } from "components/EmptyState";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Button } from "react-native";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    const { getByText } = renderWithProviders(
      <EmptyState
        Icon={Icon.Image01}
        title="No collectibles yet"
        description="Collectibles you own will appear here."
      />,
    );

    expect(getByText("No collectibles yet")).toBeTruthy();
    expect(getByText("Collectibles you own will appear here.")).toBeTruthy();
  });

  it("renders without a description", () => {
    const { getByText, queryByText } = renderWithProviders(
      <EmptyState Icon={Icon.Image01} title="Nothing here" />,
    );

    expect(getByText("Nothing here")).toBeTruthy();
    expect(queryByText("appear here")).toBeNull();
  });

  it("renders rich description spans and the action slot", () => {
    const onLinkPress = jest.fn();
    const onActionPress = jest.fn();
    const { getByText } = renderWithProviders(
      <EmptyState
        Icon={Icon.Coins01}
        title="Looking a little empty..."
        description={
          <>
            Add at least{" "}
            <Text sm medium primary>
              2 XLM
            </Text>{" "}
            to activate.{" "}
            <Text sm medium onPress={onLinkPress}>
              Learn more
            </Text>
          </>
        }
      >
        <Button title="Add XLM" onPress={onActionPress} />
      </EmptyState>,
    );

    fireEvent.press(getByText("Learn more"));
    expect(onLinkPress).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText("Add XLM"));
    expect(onActionPress).toHaveBeenCalledTimes(1);
  });
});
