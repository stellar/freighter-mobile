import { act, renderHook } from "@testing-library/react-native";
import { DiscoverProtocol } from "config/types";
import { useRecentProtocolsStore } from "ducks/recentProtocols";

const makeProtocol = (
  overrides: Partial<DiscoverProtocol> = {},
): DiscoverProtocol => ({
  name: "Protocol",
  description: "A protocol",
  iconUrl: "https://example.com/icon.png",
  websiteUrl: "https://example.com",
  tags: ["defi"],
  isTrending: false,
  ...overrides,
});

const protocols: DiscoverProtocol[] = [
  makeProtocol({ name: "Alpha", websiteUrl: "https://alpha.com" }),
  makeProtocol({ name: "Beta", websiteUrl: "https://beta.com" }),
  makeProtocol({ name: "Gamma", websiteUrl: "https://gamma.com" }),
  makeProtocol({ name: "Delta", websiteUrl: "https://delta.com" }),
  makeProtocol({ name: "Epsilon", websiteUrl: "https://epsilon.com" }),
  makeProtocol({ name: "Zeta", websiteUrl: "https://zeta.com" }),
];

describe("recentProtocols store", () => {
  beforeEach(() => {
    act(() => {
      useRecentProtocolsStore.setState({ recentProtocols: [] });
    });
  });

  describe("initial state", () => {
    it("should start with an empty list", () => {
      const { result } = renderHook(() => useRecentProtocolsStore());
      expect(result.current.recentProtocols).toEqual([]);
    });
  });

  describe("addRecentProtocol", () => {
    it("should add a matching protocol", () => {
      const { result } = renderHook(() => useRecentProtocolsStore());

      act(() => {
        result.current.addRecentProtocol("https://alpha.com", protocols);
      });

      expect(result.current.recentProtocols).toHaveLength(1);
      expect(result.current.recentProtocols[0].websiteUrl).toBe(
        "https://alpha.com",
      );
    });

    it("should ignore URLs that don't match any protocol", () => {
      const { result } = renderHook(() => useRecentProtocolsStore());

      act(() => {
        result.current.addRecentProtocol("https://unknown.com", protocols);
      });

      expect(result.current.recentProtocols).toHaveLength(0);
    });

    it("should move a re-visited protocol to the front", () => {
      const { result } = renderHook(() => useRecentProtocolsStore());

      act(() => {
        result.current.addRecentProtocol("https://alpha.com", protocols);
        result.current.addRecentProtocol("https://beta.com", protocols);
        result.current.addRecentProtocol("https://alpha.com", protocols);
      });

      expect(result.current.recentProtocols).toHaveLength(2);
      expect(result.current.recentProtocols[0].websiteUrl).toBe(
        "https://alpha.com",
      );
      expect(result.current.recentProtocols[1].websiteUrl).toBe(
        "https://beta.com",
      );
    });

    it("should cap the list at 5 protocols", () => {
      const { result } = renderHook(() => useRecentProtocolsStore());

      act(() => {
        protocols.forEach((p) => {
          result.current.addRecentProtocol(p.websiteUrl, protocols);
        });
      });

      expect(result.current.recentProtocols).toHaveLength(5);
      // The 6th added (zeta) should be first, the 1st added (alpha) should be dropped
      expect(result.current.recentProtocols[0].websiteUrl).toBe(
        "https://zeta.com",
      );
      expect(
        result.current.recentProtocols.find(
          (e) => e.websiteUrl === "https://alpha.com",
        ),
      ).toBeUndefined();
    });

    it("should update the lastAccessed timestamp", () => {
      const { result } = renderHook(() => useRecentProtocolsStore());
      const before = Date.now();

      act(() => {
        result.current.addRecentProtocol("https://alpha.com", protocols);
      });

      const after = Date.now();
      const { lastAccessed } = result.current.recentProtocols[0];
      expect(lastAccessed).toBeGreaterThanOrEqual(before);
      expect(lastAccessed).toBeLessThanOrEqual(after);
    });

    it("should match protocols by hostname regardless of path", () => {
      const { result } = renderHook(() => useRecentProtocolsStore());

      act(() => {
        result.current.addRecentProtocol(
          "https://alpha.com/swap?ref=123",
          protocols,
        );
      });

      expect(result.current.recentProtocols).toHaveLength(1);
      expect(result.current.recentProtocols[0].websiteUrl).toBe(
        "https://alpha.com",
      );
    });
  });

  describe("clearRecentProtocols", () => {
    it("should clear all recent protocols", () => {
      const { result } = renderHook(() => useRecentProtocolsStore());

      act(() => {
        result.current.addRecentProtocol("https://alpha.com", protocols);
        result.current.addRecentProtocol("https://beta.com", protocols);
      });

      expect(result.current.recentProtocols).toHaveLength(2);

      act(() => {
        result.current.clearRecentProtocols();
      });

      expect(result.current.recentProtocols).toEqual([]);
    });
  });
});
