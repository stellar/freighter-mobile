import { fireEvent, render, screen } from "@testing-library/react-native";
import { SendCollectibleCollection } from "components/screens/SendScreen/components/SendCollectibleCollection";
import { Collection } from "ducks/collectibles";
import { hostParentOf } from "helpers/testUtils";
import React from "react";
import { StyleSheet, View as mockView } from "react-native";

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

  describe("row styling", () => {
    it("divides the collectible rows, but not after the last one", () => {
      render(<SendCollectibleCollection collection={buildCollection()} />);

      // The next collection's header draws its own line, so the last row
      // has none. Send's picker shows the token list above this one, so the
      // collectibles' dividers have their own test ID.
      expect(screen.getAllByTestId("collectible-row-divider")).toHaveLength(1);
      expect(screen.queryAllByTestId("token-row-divider")).toHaveLength(0);
    });

    it("draws no divider under a collection's only row", () => {
      const collection = buildCollection();
      render(
        <SendCollectibleCollection
          collection={{ ...collection, count: 1, items: [collection.items[0]] }}
        />,
      );

      expect(screen.queryAllByTestId("collectible-row-divider")).toHaveLength(
        0,
      );
    });

    it("shows the collectible name in Text/MD/600", () => {
      render(<SendCollectibleCollection collection={buildCollection()} />);

      expect(
        StyleSheet.flatten(screen.getByText("Collectible #1").props.style),
      ).toMatchObject({ fontSize: 16, fontWeight: "600" });
    });

    it("pads the row 12pt top and bottom, with a 16pt gap to the name", () => {
      render(<SendCollectibleCollection collection={buildCollection()} />);

      // They are styles, not classes, so they scale with the screen like the
      // token rows' do (pxValue is the identity in tests).
      expect(
        StyleSheet.flatten(
          screen.getByTestId("send-collectible-row-1").props.style,
        ),
      ).toMatchObject({ paddingVertical: 12, gap: 16 });
    });

    it("shows a 40pt thumbnail with an 8pt radius", () => {
      render(<SendCollectibleCollection collection={buildCollection()} />);

      const thumbnail = hostParentOf(
        screen.getAllByTestId("collectible-image")[0],
      );

      // The size is a style, so it scales with the screen; NativeWind doesn't
      // apply classes in tests, so the radius is read off the class names.
      expect(StyleSheet.flatten(thumbnail?.props.style)).toMatchObject({
        width: 40,
        height: 40,
      });
      expect(thumbnail?.props.className).toContain("rounded-[8px]");
    });
  });
});
