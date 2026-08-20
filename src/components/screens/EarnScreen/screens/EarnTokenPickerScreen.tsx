import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnTokenRow } from "components/screens/EarnScreen/components/EarnTokenRow";
import { PoolDetailsBottomSheet } from "components/screens/EarnScreen/components/PoolDetailsBottomSheet";
import {
  EarnTokenOption,
  useEarnTokens,
} from "components/screens/EarnScreen/hooks/useEarnTokens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { useEarnStore } from "ducks/earn";
import useAppTranslation from "hooks/useAppTranslation";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useCallback, useRef } from "react";
import { SectionList, View } from "react-native";

type EarnTokenPickerScreenProps = NativeStackScreenProps<
  EarnStackParamList,
  typeof EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN
>;

interface EarnTokenSection {
  kind: "held" | "supported";
  title: string;
  data: EarnTokenOption[];
}

/**
 * Zero-balance rows aren't deposit-ready — tapping one should open the
 * "not enough" sheet Task 11 builds. Left named and empty here so the row's
 * press target and styling are correct in the meantime.
 */
const handleUnheldTokenPress = () => {};

export const EarnTokenPickerScreen: React.FC<EarnTokenPickerScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { isLoading, error, held, supported, pool, refetch } = useEarnTokens();
  const selectAsset = useEarnStore((state) => state.selectAsset);
  const poolDetailsBottomSheetModalRef = useRef<BottomSheetModal>(null);

  /**
   * Opens the pool details sheet. Guarded on `pool` because the header
   * button is wired up unconditionally (even while useEarnTokens is still
   * loading or has errored) — there is nothing to present until the pool
   * has resolved.
   */
  const handlePoolInfoPress = useCallback(() => {
    if (!pool) return;
    poolDetailsBottomSheetModalRef.current?.present();
  }, [pool]);

  useRightHeaderButton({
    onPress: handlePoolInfoPress,
    icon: Icon.InfoCircle,
  });

  const handleHeldTokenPress = useCallback(
    (option: EarnTokenOption) => {
      selectAsset({
        assetId: option.assetId,
        apy: option.apy,
        code: option.code,
        decimals: option.decimals,
      });
      navigation.navigate(EARN_ROUTES.EARN_AMOUNT_SCREEN, {
        assetId: option.assetId,
        tokenCode: option.code,
      });
    },
    [selectAsset, navigation],
  );

  if (isLoading) {
    return (
      <BaseLayout>
        <View className="flex-1 items-center justify-center">
          <Spinner testID="earn-token-picker-spinner" />
        </View>
      </BaseLayout>
    );
  }

  // Blend's routes are not deployed to staging or production yet — this is
  // the flow's most-exercised path in the real app today. It must read as a
  // failure to load, never as "no tokens available" (which would be
  // actively misleading about why the list is empty).
  if (error) {
    return (
      <BaseLayout>
        <View className="flex-1 items-center justify-center px-6">
          <Text md medium primary textAlign="center">
            {t("earnTokenPicker.error.title")}
          </Text>
          <View className="h-2" />
          <Text sm secondary textAlign="center">
            {t("earnTokenPicker.error.body")}
          </Text>
          <View className="h-6" />
          <Button secondary onPress={refetch} testID="earn-token-picker-retry">
            {t("earnTokenPicker.error.retry")}
          </Button>
        </View>
      </BaseLayout>
    );
  }

  const sections: EarnTokenSection[] = [
    {
      kind: "held" as const,
      title: t("earnTokenPicker.inYourAccount"),
      data: held,
    },
    {
      kind: "supported" as const,
      title: t("earnTokenPicker.supportedTokens"),
      data: supported,
    },
  ].filter((section) => section.data.length > 0);

  return (
    <>
      <BaseLayout insets={{ top: false, bottom: false }}>
        <SectionList<EarnTokenOption, EarnTokenSection>
          sections={sections}
          keyExtractor={(item) => item.assetId}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View className="mt-4 mb-6">
              <Text md medium secondary>
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item, section }) => (
            <EarnTokenRow
              option={item}
              testID={`earn-token-option-${item.code}`}
              onPress={() =>
                section.kind === "held"
                  ? handleHeldTokenPress(item)
                  : handleUnheldTokenPress()
              }
            />
          )}
          ListFooterComponent={
            <View className="mt-2 mb-6">
              <Text xs secondary textAlign="center">
                {t("earnTokenPicker.apyDisclaimer")}
              </Text>
            </View>
          }
        />
      </BaseLayout>
      <BottomSheet
        modalRef={poolDetailsBottomSheetModalRef}
        handleCloseModal={() =>
          poolDetailsBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <PoolDetailsBottomSheet
            pool={pool}
            bottomSheetModalRef={poolDetailsBottomSheetModalRef}
          />
        }
      />
    </>
  );
};

export default EarnTokenPickerScreen;
