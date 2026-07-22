import { fireEvent, render, screen } from "@testing-library/react-native";
import { CollectionSection } from "components/CollectionSection";
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
  collectionName: "Soroban Frogs",
  collectionSymbol: "FROG",
  count: 3,
  items: [
    {
      collectionAddress: "CABC",
      collectionName: "Soroban Frogs",
      tokenId: "1",
      image: "https://example.com/1.png",
    },
    {
      collectionAddress: "CABC",
      collectionName: "Soroban Frogs",
      tokenId: "2",
      image: "https://example.com/2.png",
    },
    {
      collectionAddress: "CABC",
      collectionName: "Soroban Frogs",
      tokenId: "3",
      image: "https://example.com/3.png",
    },
  ],
  ...overrides,
});

describe("CollectionSection", () => {
  it("renders the collection name and item count without a header divider", () => {
    render(<CollectionSection collection={buildCollection()} />);

    expect(screen.getByText("Soroban Frogs")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.queryByTestId("collection-header-divider")).toBeNull();
  });

  it("shows tiles when expanded by default and hides them when the header is tapped", () => {
    render(<CollectionSection collection={buildCollection()} />);

    expect(screen.queryAllByTestId("collectible-image")).toHaveLength(3);

    fireEvent.press(screen.getByTestId("collection-header-CABC"));
    expect(screen.queryAllByTestId("collectible-image")).toHaveLength(0);

    fireEvent.press(screen.getByTestId("collection-header-CABC"));
    expect(screen.queryAllByTestId("collectible-image")).toHaveLength(3);
  });

  it("renders a spacer for an odd number of items and none for an even number", () => {
    const { rerender } = render(
      <CollectionSection collection={buildCollection()} />,
    );
    expect(screen.getByTestId("collection-grid-spacer")).toBeTruthy();

    rerender(
      <CollectionSection
        collection={buildCollection({
          items: [
            {
              collectionAddress: "CABC",
              collectionName: "Soroban Frogs",
              tokenId: "1",
              image: "a",
            },
            {
              collectionAddress: "CABC",
              collectionName: "Soroban Frogs",
              tokenId: "2",
              image: "b",
            },
          ],
          count: 2,
        })}
      />,
    );
    expect(screen.queryByTestId("collection-grid-spacer")).toBeNull();
  });

  it("renders the hidden overlay only for hidden items", () => {
    render(
      <CollectionSection
        collection={buildCollection({
          items: [
            {
              collectionAddress: "CABC",
              collectionName: "Soroban Frogs",
              tokenId: "1",
              image: "a",
            },
            {
              collectionAddress: "CABC",
              collectionName: "Soroban Frogs",
              tokenId: "2",
              image: "b",
              isHidden: true,
            },
          ],
          count: 2,
        })}
      />,
    );

    expect(screen.queryByTestId("collectible-hidden-overlay-1")).toBeNull();
    expect(screen.getByTestId("collectible-hidden-overlay-2")).toBeTruthy();
  });

  it("exposes the expanded state on the header for screen readers", () => {
    render(<CollectionSection collection={buildCollection()} />);

    const header = screen.getByTestId("collection-header-CABC");
    expect(header.props.accessibilityState.expanded).toBe(true);

    fireEvent.press(header);
    expect(header.props.accessibilityState.expanded).toBe(false);
  });

  it("calls onCollectiblePress with the collection address and token id when a tile is pressed", () => {
    const onCollectiblePress = jest.fn();
    render(
      <CollectionSection
        collection={buildCollection()}
        onCollectiblePress={onCollectiblePress}
      />,
    );

    fireEvent.press(screen.getByTestId("collectible-tile-2"));
    expect(onCollectiblePress).toHaveBeenCalledWith({
      collectionAddress: "CABC",
      tokenId: "2",
    });
  });
});
