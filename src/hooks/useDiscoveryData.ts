import { TrendingItem } from "components/TrendingCarousel";
import { VerticalListItem } from "components/screens/DiscoveryScreen/components/VerticalListSection";
import { DiscoverProtocol } from "config/types";
import { useProtocolsStore } from "ducks/protocols";
import { useRecentProtocolsStore } from "ducks/recentProtocols";
import { useMemo } from "react";

const protocolToListItem = (protocol: DiscoverProtocol): VerticalListItem => ({
  id: protocol.websiteUrl,
  name: protocol.name,
  subtitle: protocol.tags[0] ?? "",
  iconUrl: protocol.iconUrl,
  websiteUrl: protocol.websiteUrl,
  description: protocol.description,
  tags: protocol.tags,
});

const useDiscoveryData = () => {
  const { protocols } = useProtocolsStore();
  const { recentProtocols, addRecentProtocol, clearRecentProtocols } =
    useRecentProtocolsStore();

  const trendingCarouselItems: TrendingItem[] = useMemo(
    () =>
      protocols
        .filter((protocol) => protocol.isTrending)
        .map((protocol) => ({
          id: protocol.websiteUrl,
          title: protocol.name,
          category: protocol.tags[0] ?? "",
          backgroundUrl: protocol.backgroundUrl,
        })),
    [protocols],
  );

  const protocolsByUrl = useMemo(
    () => new Map(protocols.map((p) => [p.websiteUrl, p])),
    [protocols],
  );

  const recentItems: VerticalListItem[] = useMemo(
    () =>
      recentProtocols
        .map((entry) => protocolsByUrl.get(entry.websiteUrl))
        .filter((p): p is DiscoverProtocol => p !== undefined)
        .map(protocolToListItem),
    [recentProtocols, protocolsByUrl],
  );

  const dappsItems: VerticalListItem[] = useMemo(
    () => protocols.map(protocolToListItem),
    [protocols],
  );

  return {
    protocols,
    trendingCarouselItems,
    recentItems,
    dappsItems,
    addRecentProtocol,
    clearRecentProtocols,
  };
};

export { protocolToListItem };
export default useDiscoveryData;
