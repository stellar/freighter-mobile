import { CollapsibleCollectionHeader } from "components/CollapsibleCollectionHeader";
import { CollectibleImage } from "components/CollectibleImage";
import {
  TOKEN_ROW_GAP,
  TOKEN_ROW_ICON_SIZE,
  TOKEN_ROW_VERTICAL_PADDING,
  TokenRowDivider,
} from "components/TokenRowStyle";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import { Collection } from "ducks/collectibles";
import { pxValue } from "helpers/dimensions";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";

interface SendCollectibleCollectionProps {
  /** The collection to render (collapsible header + vertical list of items). */
  collection: Collection;
  /** Called when a collectible row is pressed. */
  onCollectiblePress?: (args: {
    collectionAddress: string;
    tokenId: string;
  }) => void;
}

/**
 * A token row's icon, gap and padding (Figma's 40pt, 16pt and 12pt), scaled
 * with the screen the way the token rows scale them.
 */
const ROW_STYLE = {
  gap: pxValue(TOKEN_ROW_GAP),
  paddingVertical: pxValue(TOKEN_ROW_VERTICAL_PADDING),
};
const THUMBNAIL_STYLE = {
  width: pxValue(TOKEN_ROW_ICON_SIZE),
  height: pxValue(TOKEN_ROW_ICON_SIZE),
};

/**
 * SendCollectibleCollection Component
 *
 * Renders a single collectibles collection in the Send flow as a collapsible
 * section: the shared collapsible header (name + count badge + chevron) over a
 * single vertical list of collectible rows (thumbnail + name). Collapse state is
 * local and in-memory (default expanded).
 *
 * The rows match the token rows above them in the picker: the name in
 * Text/MD/600, a 40pt thumbnail, a 16pt gap after it, 12pt of padding above and
 * below (TokenRowStyle's sizes) and a divider under every row but the last,
 * where the next collection's header draws its own line. Those sizes
 * are styles run through `pxValue`, as the token rows' are, not classes: a
 * class can't scale with the screen, and the divider (inset by
 * `pxValue(TOKEN_ROW_TEXT_INSET)`) only lines up with the names if the row
 * scales too. (With NativeWind's 14px rem, `py-3` and `gap-4` would also come
 * out at 10.5 and 14pt.)
 */
export const SendCollectibleCollection: React.FC<
  SendCollectibleCollectionProps
> = ({ collection, onCollectiblePress }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  return (
    <View className="mt-3">
      <CollapsibleCollectionHeader
        collectionName={collection.collectionName}
        count={collection.items.length}
        isExpanded={isExpanded}
        onToggle={toggleExpanded}
        testID={`send-collection-header-${collection.collectionAddress}`}
        showDivider
      />

      {isExpanded && (
        <View className="mt-3">
          {collection.items.map((item, index) => (
            <React.Fragment key={`${item.collectionAddress}-${item.tokenId}`}>
              <TouchableOpacity
                className="flex-row items-center"
                style={ROW_STYLE}
                delayPressIn={DEFAULT_PRESS_DELAY}
                testID={`send-collectible-row-${item.tokenId}`}
                onPress={() =>
                  onCollectiblePress?.({
                    collectionAddress: item.collectionAddress,
                    tokenId: item.tokenId,
                  })
                }
              >
                <View
                  className="rounded-[8px] overflow-hidden bg-background-tertiary"
                  style={THUMBNAIL_STYLE}
                >
                  <CollectibleImage
                    imageUri={item.image}
                    placeholderIconSize={20}
                  />
                </View>

                <Text md semiBold numberOfLines={1} style={{ flexShrink: 1 }}>
                  {item.name || `${collection.collectionName} #${item.tokenId}`}
                </Text>
              </TouchableOpacity>
              {/* None after the last row: the next collection's header
                  draws its own line. Its own test ID: the picker lists
                  tokens above, whose dividers keep the default one. */}
              {index < collection.items.length - 1 && (
                <TokenRowDivider testID="collectible-row-divider" />
              )}
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
};

SendCollectibleCollection.displayName = "SendCollectibleCollection";
