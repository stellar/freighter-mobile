import { act, renderHook } from "@testing-library/react-native";
import { DiscoverProtocol } from "config/types";
import { useProtocolsStore } from "ducks/protocols";
import { useRecentProtocolsStore } from "ducks/recentProtocols";
import useDiscoveryData from "hooks/useDiscoveryData";

const makeProtocol = (
  overrides: Partial<DiscoverProtocol> = {},
): DiscoverProtocol => ({
  name: "Protocol",
  description: "A protocol",
  iconUrl: "https://example.com/icon.png",
  websiteUrl: "https://example.com",
  tags: ["defi"],
  backgroundUrl: "https://example.com/bg.png",
  isTrending: false,
  ...overrides,
});

const protocols: DiscoverProtocol[] = [
  makeProtocol({
    name: "Alpha",
    websiteUrl: "https://alpha.com",
    tags: ["defi", "swap"],
    isTrending: true,
    backgroundUrl: "https://alpha.com/bg.png",
  }),
  makeProtocol({
    name: "Beta",
    websiteUrl: "https://beta.com",
    tags: ["nft"],
    isTrending: false,
  }),
  makeProtocol({
    name: "Gamma",
    websiteUrl: "https://gamma.com",
    tags: ["defi"],
    isTrending: true,
    backgroundUrl: "https://gamma.com/bg.png",
  }),
];

describe("useDiscoveryData", () => {
  beforeEach(() => {
    act(() => {
      useProtocolsStore.setState({ protocols });
      useRecentProtocolsStore.setState({ recentProtocols: [] });
    });
  });

  describe("trendingCarouselItems", () => {
    it("should return only trending protocols as TrendingItem", () => {
      const { result } = renderHook(() => useDiscoveryData());

      expect(result.current.trendingCarouselItems).toHaveLength(2);
      expect(result.current.trendingCarouselItems).toEqual([
        {
          id: "https://alpha.com",
          title: "Alpha",
          category: "defi",
          backgroundUrl: "https://alpha.com/bg.png",
        },
        {
          id: "https://gamma.com",
          title: "Gamma",
          category: "defi",
          backgroundUrl: "https://gamma.com/bg.png",
        },
      ]);
    });
  });

  describe("dappsItems", () => {
    it("should return all protocols as VerticalListItem", () => {
      const { result } = renderHook(() => useDiscoveryData());

      expect(result.current.dappsItems).toHaveLength(3);
      expect(result.current.dappsItems.map((i) => i.name)).toEqual([
        "Alpha",
        "Beta",
        "Gamma",
      ]);
    });

    it("should use first tag as subtitle", () => {
      const { result } = renderHook(() => useDiscoveryData());

      expect(result.current.dappsItems[0].subtitle).toBe("defi");
      expect(result.current.dappsItems[1].subtitle).toBe("nft");
    });

    it("should use empty string when protocol has no tags", () => {
      act(() => {
        useProtocolsStore.setState({
          protocols: [makeProtocol({ tags: [] })],
        });
      });

      const { result } = renderHook(() => useDiscoveryData());
      expect(result.current.dappsItems[0].subtitle).toBe("");
    });
  });

  describe("recentItems", () => {
    it("should return empty when no recent protocols exist", () => {
      const { result } = renderHook(() => useDiscoveryData());
      expect(result.current.recentItems).toEqual([]);
    });

    it("should resolve recent entries to VerticalListItem", () => {
      act(() => {
        useRecentProtocolsStore.setState({
          recentProtocols: [
            { websiteUrl: "https://beta.com", lastAccessed: 1000 },
            { websiteUrl: "https://alpha.com", lastAccessed: 900 },
          ],
        });
      });

      const { result } = renderHook(() => useDiscoveryData());

      expect(result.current.recentItems).toHaveLength(2);
      expect(result.current.recentItems[0].name).toBe("Beta");
      expect(result.current.recentItems[1].name).toBe("Alpha");
    });

    it("should filter out recent entries whose protocol no longer exists", () => {
      act(() => {
        useRecentProtocolsStore.setState({
          recentProtocols: [
            { websiteUrl: "https://deleted.com", lastAccessed: 1000 },
            { websiteUrl: "https://alpha.com", lastAccessed: 900 },
          ],
        });
      });

      const { result } = renderHook(() => useDiscoveryData());

      expect(result.current.recentItems).toHaveLength(1);
      expect(result.current.recentItems[0].name).toBe("Alpha");
    });
  });

  describe("passthrough actions", () => {
    it("should expose addRecentProtocol from the store", () => {
      const { result } = renderHook(() => useDiscoveryData());
      expect(typeof result.current.addRecentProtocol).toBe("function");
    });

    it("should expose clearRecentProtocols from the store", () => {
      const { result } = renderHook(() => useDiscoveryData());
      expect(typeof result.current.clearRecentProtocols).toBe("function");
    });
  });
});
