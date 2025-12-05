import { renderHook } from "@testing-library/react-native";
import type { Collection } from "ducks/collectibles";
import { useFilteredCollectibles } from "hooks/useFilteredCollectibles";

// Mock the collectibles store
const mockCollections: Collection[] = [];
const mockUseCollectiblesStore = jest.fn(
  (selector: (state: { collections: Collection[] }) => Collection[]) =>
    selector({ collections: mockCollections }),
);

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: (selector: any) => mockUseCollectiblesStore(selector),
}));

describe("useFilteredCollectibles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollections.length = 0; // Clear collections array
  });

  it("should return empty arrays when collections is empty", () => {
    const { result } = renderHook(() => useFilteredCollectibles());

    expect(result.current.visibleCollectibles).toEqual([]);
    expect(result.current.hiddenCollectibles).toEqual([]);
  });

  it("should return only visible collectibles when all items are visible", () => {
    mockCollections.push({
      collectionAddress: "collection1",
      collectionName: "Test Collection 1",
      collectionSymbol: "TC1",
      count: 2,
      items: [
        {
          collectionAddress: "collection1",
          collectionName: "Test Collection 1",
          tokenId: "token1",
          name: "Visible NFT 1",
          image: "https://example.com/image1.jpg",
          isHidden: false,
        },
        {
          collectionAddress: "collection1",
          collectionName: "Test Collection 1",
          tokenId: "token2",
          name: "Visible NFT 2",
          image: "https://example.com/image2.jpg",
          isHidden: false,
        },
      ],
    });

    const { result } = renderHook(() => useFilteredCollectibles());

    expect(result.current.visibleCollectibles).toHaveLength(1);
    expect(result.current.visibleCollectibles[0]).toEqual({
      collectionAddress: "collection1",
      collectionName: "Test Collection 1",
      collectionSymbol: "TC1",
      count: 2,
      items: [
        {
          collectionAddress: "collection1",
          collectionName: "Test Collection 1",
          tokenId: "token1",
          name: "Visible NFT 1",
          image: "https://example.com/image1.jpg",
          isHidden: false,
        },
        {
          collectionAddress: "collection1",
          collectionName: "Test Collection 1",
          tokenId: "token2",
          name: "Visible NFT 2",
          image: "https://example.com/image2.jpg",
          isHidden: false,
        },
      ],
    });
    expect(result.current.hiddenCollectibles).toEqual([]);
  });

  it("should return only hidden collectibles when all items are hidden", () => {
    mockCollections.push({
      collectionAddress: "collection2",
      collectionName: "Test Collection 2",
      collectionSymbol: "TC2",
      count: 2,
      items: [
        {
          collectionAddress: "collection2",
          collectionName: "Test Collection 2",
          tokenId: "token3",
          name: "Hidden NFT 1",
          image: "https://example.com/image3.jpg",
          isHidden: true,
        },
        {
          collectionAddress: "collection2",
          collectionName: "Test Collection 2",
          tokenId: "token4",
          name: "Hidden NFT 2",
          image: "https://example.com/image4.jpg",
          isHidden: true,
        },
      ],
    });

    const { result } = renderHook(() => useFilteredCollectibles());

    expect(result.current.visibleCollectibles).toEqual([]);
    expect(result.current.hiddenCollectibles).toHaveLength(1);
    expect(result.current.hiddenCollectibles[0]).toEqual({
      collectionAddress: "collection2",
      collectionName: "Test Collection 2",
      collectionSymbol: "TC2",
      count: 2,
      items: [
        {
          collectionAddress: "collection2",
          collectionName: "Test Collection 2",
          tokenId: "token3",
          name: "Hidden NFT 1",
          image: "https://example.com/image3.jpg",
          isHidden: true,
        },
        {
          collectionAddress: "collection2",
          collectionName: "Test Collection 2",
          tokenId: "token4",
          name: "Hidden NFT 2",
          image: "https://example.com/image4.jpg",
          isHidden: true,
        },
      ],
    });
  });

  it("should separate visible and hidden collectibles in the same collection", () => {
    mockCollections.push({
      collectionAddress: "collection3",
      collectionName: "Test Collection 3",
      collectionSymbol: "TC3",
      count: 3,
      items: [
        {
          collectionAddress: "collection3",
          collectionName: "Test Collection 3",
          tokenId: "token5",
          name: "Visible NFT",
          image: "https://example.com/image5.jpg",
          isHidden: false,
        },
        {
          collectionAddress: "collection3",
          collectionName: "Test Collection 3",
          tokenId: "token6",
          name: "Hidden NFT",
          image: "https://example.com/image6.jpg",
          isHidden: true,
        },
        {
          collectionAddress: "collection3",
          collectionName: "Test Collection 3",
          tokenId: "token7",
          name: "Another Visible NFT",
          image: "https://example.com/image7.jpg",
          isHidden: false,
        },
      ],
    });

    const { result } = renderHook(() => useFilteredCollectibles());

    expect(result.current.visibleCollectibles).toHaveLength(1);
    expect(result.current.visibleCollectibles[0].items).toHaveLength(2);
    expect(result.current.visibleCollectibles[0].items[0].tokenId).toBe(
      "token5",
    );
    expect(result.current.visibleCollectibles[0].items[1].tokenId).toBe(
      "token7",
    );
    expect(result.current.visibleCollectibles[0].count).toBe(2);

    expect(result.current.hiddenCollectibles).toHaveLength(1);
    expect(result.current.hiddenCollectibles[0].items).toHaveLength(1);
    expect(result.current.hiddenCollectibles[0].items[0].tokenId).toBe(
      "token6",
    );
    expect(result.current.hiddenCollectibles[0].count).toBe(1);
  });

  it("should handle collections with undefined isHidden as visible", () => {
    mockCollections.push({
      collectionAddress: "collection4",
      collectionName: "Test Collection 4",
      collectionSymbol: "TC4",
      count: 2,
      items: [
        {
          collectionAddress: "collection4",
          collectionName: "Test Collection 4",
          tokenId: "token8",
          name: "NFT without isHidden",
          image: "https://example.com/image8.jpg",
          // isHidden is undefined
        },
        {
          collectionAddress: "collection4",
          collectionName: "Test Collection 4",
          tokenId: "token9",
          name: "Hidden NFT",
          image: "https://example.com/image9.jpg",
          isHidden: true,
        },
      ],
    });

    const { result } = renderHook(() => useFilteredCollectibles());

    expect(result.current.visibleCollectibles).toHaveLength(1);
    expect(result.current.visibleCollectibles[0].items).toHaveLength(1);
    expect(result.current.visibleCollectibles[0].items[0].tokenId).toBe(
      "token8",
    );

    expect(result.current.hiddenCollectibles).toHaveLength(1);
    expect(result.current.hiddenCollectibles[0].items).toHaveLength(1);
    expect(result.current.hiddenCollectibles[0].items[0].tokenId).toBe(
      "token9",
    );
  });

  it("should handle multiple collections with mixed visibility", () => {
    mockCollections.push(
      {
        collectionAddress: "collection5",
        collectionName: "Test Collection 5",
        collectionSymbol: "TC5",
        count: 2,
        items: [
          {
            collectionAddress: "collection5",
            collectionName: "Test Collection 5",
            tokenId: "token10",
            name: "Visible NFT",
            image: "https://example.com/image10.jpg",
            isHidden: false,
          },
          {
            collectionAddress: "collection5",
            collectionName: "Test Collection 5",
            tokenId: "token11",
            name: "Hidden NFT",
            image: "https://example.com/image11.jpg",
            isHidden: true,
          },
        ],
      },
      {
        collectionAddress: "collection6",
        collectionName: "Test Collection 6",
        collectionSymbol: "TC6",
        count: 1,
        items: [
          {
            collectionAddress: "collection6",
            collectionName: "Test Collection 6",
            tokenId: "token12",
            name: "Another Visible NFT",
            image: "https://example.com/image12.jpg",
            isHidden: false,
          },
        ],
      },
      {
        collectionAddress: "collection7",
        collectionName: "Test Collection 7",
        collectionSymbol: "TC7",
        count: 1,
        items: [
          {
            collectionAddress: "collection7",
            collectionName: "Test Collection 7",
            tokenId: "token13",
            name: "Another Hidden NFT",
            image: "https://example.com/image13.jpg",
            isHidden: true,
          },
        ],
      },
    );

    const { result } = renderHook(() => useFilteredCollectibles());

    expect(result.current.visibleCollectibles).toHaveLength(2);
    expect(result.current.visibleCollectibles[0].collectionAddress).toBe(
      "collection5",
    );
    expect(result.current.visibleCollectibles[0].count).toBe(1);
    expect(result.current.visibleCollectibles[1].collectionAddress).toBe(
      "collection6",
    );
    expect(result.current.visibleCollectibles[1].count).toBe(1);

    expect(result.current.hiddenCollectibles).toHaveLength(2);
    expect(result.current.hiddenCollectibles[0].collectionAddress).toBe(
      "collection5",
    );
    expect(result.current.hiddenCollectibles[0].count).toBe(1);
    expect(result.current.hiddenCollectibles[1].collectionAddress).toBe(
      "collection7",
    );
    expect(result.current.hiddenCollectibles[1].count).toBe(1);
  });

  it("should exclude collections with no items after filtering", () => {
    mockCollections.push({
      collectionAddress: "collection8",
      collectionName: "Test Collection 8",
      collectionSymbol: "TC8",
      count: 0,
      items: [],
    });

    const { result } = renderHook(() => useFilteredCollectibles());

    expect(result.current.visibleCollectibles).toEqual([]);
    expect(result.current.hiddenCollectibles).toEqual([]);
  });

  it("should update results when collections change", () => {
    const initialCollections: Collection[] = [
      {
        collectionAddress: "collection9",
        collectionName: "Test Collection 9",
        collectionSymbol: "TC9",
        count: 1,
        items: [
          {
            collectionAddress: "collection9",
            collectionName: "Test Collection 9",
            tokenId: "token14",
            name: "Visible NFT",
            image: "https://example.com/image14.jpg",
            isHidden: false,
          },
        ],
      },
    ];

    // Set initial collections
    mockCollections.length = 0;
    mockCollections.push(...initialCollections);

    // Mock to return a copy of the current collections
    mockUseCollectiblesStore.mockImplementation(
      (selector: (state: { collections: Collection[] }) => Collection[]) =>
        selector({ collections: [...mockCollections] }),
    );

    const { result } = renderHook(() => useFilteredCollectibles());

    expect(result.current.visibleCollectibles).toHaveLength(1);

    // Clear and create a new array with different collections
    mockCollections.length = 0;
    const updatedCollections: Collection[] = [
      {
        collectionAddress: "collection10",
        collectionName: "Test Collection 10",
        collectionSymbol: "TC10",
        count: 1,
        items: [
          {
            collectionAddress: "collection10",
            collectionName: "Test Collection 10",
            tokenId: "token15",
            name: "Hidden NFT",
            image: "https://example.com/image15.jpg",
            isHidden: true,
          },
        ],
      },
    ];

    mockCollections.push(...updatedCollections);

    // Create a new render to test with updated collections
    const { result: updatedResult } = renderHook(() =>
      useFilteredCollectibles(),
    );

    expect(updatedResult.current.visibleCollectibles).toEqual([]);
    expect(updatedResult.current.hiddenCollectibles).toHaveLength(1);
    expect(updatedResult.current.hiddenCollectibles[0].collectionAddress).toBe(
      "collection10",
    );
  });
});
