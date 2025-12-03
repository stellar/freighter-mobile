import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  CollectibleFilterType,
  CollectiblesGrid,
} from "components/CollectiblesGrid";
import { BaseLayout } from "components/layout/BaseLayout";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import React, { useCallback } from "react";

type HiddenCollectiblesScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.HIDDEN_COLLECTIBLES_SCREEN
>;

/**
 * HiddenCollectiblesScreen Component
 *
 * A screen that displays only hidden collectibles using the CollectiblesGrid component.
 * Users can tap on hidden collectibles to view their details and unhide them.
 *
 * @param {HiddenCollectiblesScreenProps} props - Component props
 * @returns {JSX.Element} The hidden collectibles screen component
 */
export const HiddenCollectiblesScreen: React.FC<
  HiddenCollectiblesScreenProps
> = ({ navigation }) => {
  /**
   * Handles when a collectible is pressed, navigating to the collectible details screen
   */
  const handleCollectiblePress = useCallback(
    ({
      collectionAddress,
      tokenId,
    }: {
      collectionAddress: string;
      tokenId: string;
    }) => {
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.COLLECTIBLE_DETAILS_SCREEN, {
        collectionAddress,
        tokenId,
      });
    },
    [navigation],
  );

  return (
    <BaseLayout
      insets={{ top: false, bottom: false, left: false, right: false }}
    >
      <CollectiblesGrid
        onCollectiblePress={handleCollectiblePress}
        type={CollectibleFilterType.HIDDEN}
        disableInnerScrolling
      />
    </BaseLayout>
  );
};

export default HiddenCollectiblesScreen;
