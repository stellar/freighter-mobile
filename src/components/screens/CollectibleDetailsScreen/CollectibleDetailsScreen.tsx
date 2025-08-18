import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import { useCollectibles } from "hooks/useCollectibles";
import useColors from "hooks/useColors";
import React, { useMemo, useLayoutEffect } from "react";
import { Image, Linking, ScrollView, View } from "react-native";

type CollectibleDetailsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.COLLECTIBLE_DETAILS_SCREEN
>;

/**
 * CollectibleDetailsScreen Component
 *
 * Displays detailed information about a specific collectible NFT including:
 * - Large collectible image
 * - Basic information (Name, Collection, Token ID)
 * - Description
 * - Traits/attributes
 * - Action buttons (View in browser, Send)
 *
 * @param {CollectibleDetailsScreenProps} props - Component props
 * @returns {JSX.Element} The collectible details screen
 */
export const CollectibleDetailsScreen: React.FC<
  CollectibleDetailsScreenProps
> = ({ route, navigation }) => {
  const { collectionAddress, tokenId } = route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getCollectible } = useCollectibles();

  const basicInfoTitleColor = themeColors.text.secondary;

  // Get the collectible data
  const collectible = useMemo(
    () => getCollectible({ collectionAddress, tokenId }),
    [getCollectible, collectionAddress, tokenId],
  );

  // Set the header title to the collectible name
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: collectible?.name || t("collectibleDetails.title"),
    });
  }, [navigation, collectible?.name, t]);

  // Handle opening the external URL
  const handleViewInBrowser = async () => {
    if (collectible?.externalUrl) {
      try {
        await Linking.openURL(collectible.externalUrl);
      } catch (error) {
        // Silently handle URL opening errors
        // In a production app, you might want to show a toast notification
      }
    }
  };

  // If collectible is not found, show error state
  if (!collectible) {
    return (
      <BaseLayout insets={{ top: false }}>
        <View className="flex-1 items-center justify-center p-4">
          <View className="mb-3">
            <Text lg medium>
              {t("collectibleDetails.notFound")}
            </Text>
          </View>
        </View>
      </BaseLayout>
    );
  }

  // Prepare list items for basic information
  const basicInfoItems = [
    {
      key: "name",
      title: t("collectibleDetails.name"),
      titleColor: basicInfoTitleColor,
      trailingContent: (
        <Text md medium>
          {collectible.name}
        </Text>
      ),
    },
    {
      key: "collection",
      title: t("collectibleDetails.collection"),
      titleColor: basicInfoTitleColor,
      trailingContent: (
        <Text md medium>
          {collectible.collectionName}
        </Text>
      ),
    },
    {
      key: "tokenId",
      title: t("collectibleDetails.tokenId"),
      titleColor: basicInfoTitleColor,
      trailingContent: (
        <Text md medium>
          {collectible.tokenId}
        </Text>
      ),
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <ScrollView className="flex-1 mb-7" showsVerticalScrollIndicator={false}>
        {/* Collectible Image */}
        <View className="w-[354px] h-[354px] rounded-[32px] overflow-hidden items-center justify-center bg-background-tertiary mt-2 mb-6">
          {/* Placeholder icon for when the image is not loaded */}
          <View className="absolute z-1">
            <Icon.Image01 size={90} color={themeColors.text.secondary} />
          </View>

          {/* NFT image */}
          <View className="absolute z-10 w-full h-full">
            <Image
              source={{ uri: collectible.image }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Basic Information */}
        <View className="mb-6">
          <List items={basicInfoItems} variant="secondary" />
        </View>

        {/* Description */}
        <View className="mb-6 bg-background-tertiary rounded-2xl p-4">
          <View className="mb-3">
            <Text md medium secondary>
              {t("collectibleDetails.description")}
            </Text>
          </View>
          <Text md medium>
            {collectible.description}
          </Text>
        </View>

        {/* Collectible Traits */}
        <View className="mb-6 bg-background-tertiary rounded-2xl p-4">
          <View className="mb-3">
            <Text md medium secondary>
              {t("collectibleDetails.traits")}
            </Text>
          </View>
          <View className="flex-row flex-wrap justify-between">
            {collectible.traits.map((trait) => (
              <View
                key={`${trait.name}-${trait.value}`}
                className="bg-background-secondary rounded-2xl p-4 w-[48%] mb-3 items-center justify-center"
              >
                <Text sm medium textAlign="center">
                  {trait.value}
                </Text>
                <View className="mt-1">
                  <Text sm secondary textAlign="center">
                    {trait.name}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom spacing for floating buttons */}
        <View className="h-10" />
      </ScrollView>

      <Button
        tertiary
        xl
        isFullWidth
        icon={
          <Icon.LinkExternal01
            size={18}
            color={themeColors.foreground.primary}
          />
        }
        onPress={handleViewInBrowser}
      >
        {t("collectibleDetails.view")}
      </Button>
    </BaseLayout>
  );
};

export default CollectibleDetailsScreen;
