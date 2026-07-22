import { fireEvent, render, screen } from "@testing-library/react-native";
import { SendCollectibleCollection } from "components/screens/SendScreen/components/SendCollectibleCollection";
import { Collection } from "ducks/collectibles";
import React from "react";
import { View as mockView } from "react-native";

const MockView = mockView;

// Avoid real image loading; icons resolve through the configured svgMock and
// useColors works without a provider, so neither needs mocking.
jest.mock("components/CollectibleImage", () => ({
  CollectibleImage: () => <MockView testID="collectible-image" />,
}));

const buildCollection = (overrides: Partial<Collection> = {}): Collection => ({
  collectionAddress: "CABC",
  collectionName: "Cool Collection",
  collectionSymbol: "COOL",
  count: 2,
  items: [
    {
      collectionAddress: "CABC",
      collectionName: "Cool Collection",
      tokenId: "1",
      image: "https://example.com/1.png",
      name: "Collectible #1",
    },
    {
      collectionAddress: "CABC",
      collectionName: "Cool Collection",
      tokenId: "2",
      image: "https://example.com/2.png",
      name: "Collectible #2",
    },
  ],
  ...overrides,
});

describe("SendCollectibleCollection", () => {
  it("renders the collection name, item count, and the header divider", () => {
    render(<SendCollectibleCollection collection={buildCollection()} />);

    expect(screen.getByText("Cool Collection")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByTestId("collection-header-divider")).toBeTruthy();
  });

  it("shows rows when expanded by default and hides them when the header is tapped", () => {
    render(<SendCollectibleCollection collection={buildCollection()} />);

    expect(screen.getByTestId("send-collectible-row-1")).toBeTruthy();
    expect(screen.getByTestId("send-collectible-row-2")).toBeTruthy();

    fireEvent.press(screen.getByTestId("send-collection-header-CABC"));
    expect(screen.queryByTestId("send-collectible-row-1")).toBeNull();

    fireEvent.press(screen.getByTestId("send-collection-header-CABC"));
    expect(screen.getByTestId("send-collectible-row-1")).toBeTruthy();
  });

  it("falls back to a generated name when the collectible has none", () => {
    render(
      <SendCollectibleCollection
        collection={buildCollection({
          items: [
            {
              collectionAddress: "CABC",
              collectionName: "Cool Collection",
              tokenId: "7",
              image: "https://example.com/7.png",
            },
          ],
          count: 1,
        })}
      />,
    );

    expect(screen.getByText("Cool Collection #7")).toBeTruthy();
  });

  it("calls onCollectiblePress with the collection address and token id when a row is pressed", () => {
    const onCollectiblePress = jest.fn();
    render(
      <SendCollectibleCollection
        collection={buildCollection()}
        onCollectiblePress={onCollectiblePress}
      />,
    );

    fireEvent.press(screen.getByTestId("send-collectible-row-2"));
    expect(onCollectiblePress).toHaveBeenCalledWith({
      collectionAddress: "CABC",
      tokenId: "2",
    });
  });
});
