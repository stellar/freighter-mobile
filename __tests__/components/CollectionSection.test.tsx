import { fireEvent, render, screen } from "@testing-library/react-native";
import { CollectionSection } from "components/CollectionSection";
import { Collection } from "ducks/collectibles";
import { hostParentOf } from "helpers/testUtils";
import React from "react";
import { TouchableOpacity, View as mockView } from "react-native";

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

  it("exposes each tile as a button labeled for screen readers", () => {
    render(<CollectionSection collection={buildCollection()} />);

    const tile = screen.getByTestId("collectible-tile-1");
    expect(tile.props.accessibilityRole).toBe("button");
    expect(tile.props.accessibilityLabel).toBe("Soroban Frogs #1");
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

  describe("spacing and shape", () => {
    // NativeWind doesn't apply classes in tests, so every size here is read
    // off the class names. They are arbitrary values on purpose: with
    // NativeWind's rem at 14, `mb-4` and `gap-4` would come out at 14pt, not
    // Figma's 16, and `rounded-xl` at 10.5pt, not 12.
    it("puts the grid 8pt below its header and its rows 8pt apart", () => {
      render(<CollectionSection collection={buildCollection()} />);

      // The grid is the view around the rows. Its gap is the one between rows;
      // the tiles of a row are further apart (next test).
      const row = hostParentOf(screen.getByTestId("collectible-tile-1"));
      const grid = row && hostParentOf(row);
      expect(grid?.props.className).toContain("mt-[8px]");
      expect(grid?.props.className).toContain("gap-[8px]");
    });

    // Figma puts 16pt between collections and none after the last, so the
    // grid around them owns that gap (CollectiblesGrid's tests). A trailing
    // margin here would stack on the 12pt before Home's Add collectible
    // button, which would then sit 28pt away instead of 12.
    it("has no margin of its own around it", () => {
      render(
        <CollectionSection collection={buildCollection()} testID="section" />,
      );

      const classes = (
        screen.getByTestId("section").props.className ?? ""
      ).split(" ");

      expect(
        classes.filter((name: string) => /^-?m[trblxy]?-/.test(name)),
      ).toEqual([]);
    });

    it("puts 16pt between the tiles of a row, and between a lone tile and its spacer", () => {
      render(<CollectionSection collection={buildCollection()} />);

      const fullRow = hostParentOf(screen.getByTestId("collectible-tile-1"));
      const loneTileRow = hostParentOf(
        screen.getByTestId("collectible-tile-3"),
      );

      expect(fullRow?.props.className).toContain("gap-[16px]");
      expect(loneTileRow?.props.className).toContain("gap-[16px]");
      // The spacer sits in the lone tile's row, so that row's gap is between them.
      expect(hostParentOf(screen.getByTestId("collection-grid-spacer"))).toBe(
        loneTileRow,
      );
    });

    it("rounds tiles 12pt", () => {
      render(<CollectionSection collection={buildCollection()} />);

      // A TouchableOpacity doesn't pass `className` on to its native view, so
      // it is read off the element itself.
      const tiles = screen
        .UNSAFE_getAllByType(TouchableOpacity)
        .filter(({ props }) => /^collectible-tile-/.test(props.testID));

      expect(tiles).toHaveLength(3);
      tiles.forEach(({ props }) => {
        expect(props.className).toContain("rounded-[12px]");
      });
    });
  });
});
