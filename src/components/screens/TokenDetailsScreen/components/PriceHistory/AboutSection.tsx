import { List, ListItemProps } from "components/List";
import { makeDetailRow } from "components/screens/TokenDetailsScreen/components/PriceHistory/detailRow";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { TokenIdentifier } from "config/types";
import { getIssuerHomeDomain } from "helpers/issuerHomeDomain";
import { truncateAddress } from "helpers/stellar";
import { classifyToken, isNativeKind } from "helpers/tokenClassification";
import useAppTranslation from "hooks/useAppTranslation";
import usePriceHistoryEnabled from "hooks/usePriceHistoryEnabled";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

interface AboutSectionProps {
  /** Route-param token identifier ("native" for XLM) */
  tokenId: TokenIdentifier;
  network: NETWORKS;
}

/**
 * Issuer / Type / Domain. The domain is the issuer account's Horizon
 * `home_domain`; rows without data are omitted. XLM keeps the canonical
 * "Stellar Network" / "stellar.org" identity.
 */
const AboutSection: React.FC<AboutSectionProps> = ({ tokenId, network }) => {
  const { t } = useAppTranslation();
  const isEnabled = usePriceHistoryEnabled(network);
  // Stored WITH the issuer it belongs to. Clearing it in the effect is a
  // render too late: route params update in place, so the render that first
  // carries issuer B still holds A's domain, and the row shows B's issuer
  // beside A's domain until the new lookup resolves.
  const [resolvedDomain, setResolvedDomain] = useState<{
    address: string;
    network: NETWORKS;
    domain: string | null;
  } | null>(null);

  const { kind, address } = classifyToken(tokenId, network);
  const homeDomain =
    resolvedDomain &&
    resolvedDomain.address === address &&
    resolvedDomain.network === network
      ? resolvedDomain.domain
      : null;

  useEffect(() => {
    let cancelled = false;

    // Only a classic G-address issuer has a Horizon account, and a card that
    // never renders must not fetch. The helper caches per session.
    if (!isEnabled || kind !== "classic" || !address) {
      return undefined;
    }

    getIssuerHomeDomain(address, network).then((domain) => {
      if (!cancelled) {
        setResolvedDomain({ address, network, domain });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isEnabled, kind, address, network]);

  if (!isEnabled) {
    return null;
  }

  const isNative = isNativeKind(kind);
  const issuerLabel = isNative
    ? t("swapScreen.trendingDetail.stellarNetwork")
    : address && truncateAddress(address);
  const domainLabel = isNative ? "stellar.org" : homeDomain;

  const rows: ListItemProps[] = [];

  if (issuerLabel) {
    rows.push(makeDetailRow(t("priceHistory.about.issuer"), issuerLabel));
  }

  rows.push(
    makeDetailRow(
      t("priceHistory.about.type"),
      t(`priceHistory.about.tokenType.${kind}`),
    ),
  );

  if (domainLabel) {
    rows.push(makeDetailRow(t("priceHistory.about.domain"), domainLabel));
  }

  return (
    <View className="gap-3" testID="about-section">
      <Text md medium secondary>
        {t("priceHistory.about.title")}
      </Text>
      <List variant="secondary" items={rows} />
    </View>
  );
};

export default AboutSection;
