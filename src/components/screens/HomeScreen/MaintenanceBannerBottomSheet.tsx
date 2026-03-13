import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { type NoticeBannerVariant } from "components/sds/NoticeBanner";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface MaintenanceBannerBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  title: string;
  body: string[];
  variant: NoticeBannerVariant;
  onDismiss: () => void;
}

type IconVariantConfig = {
  containerClass: string;
  themeColor: "gray" | "lilac" | "amber" | "red";
  icon: "info" | "infoOctagon";
};

const ICON_VARIANT_CONFIG: Record<NoticeBannerVariant, IconVariantConfig> = {
  primary: {
    containerClass: "bg-gray-3 border border-gray-6",
    themeColor: "lilac",
    icon: "info",
  },
  secondary: {
    containerClass: "bg-lilac-3 border border-lilac-6",
    themeColor: "lilac",
    icon: "info",
  },
  tertiary: {
    containerClass: "bg-gray-3 border border-gray-6",
    themeColor: "gray",
    icon: "info",
  },
  warning: {
    containerClass: "bg-amber-3 border border-amber-6",
    themeColor: "amber",
    icon: "infoOctagon",
  },
  error: {
    containerClass: "bg-red-3 border border-red-6",
    themeColor: "red",
    icon: "infoOctagon",
  },
};

const MaintenanceBannerBottomSheetContent: React.FC<{
  title: string;
  body: string[];
  variant: NoticeBannerVariant;
  onDismiss: () => void;
}> = ({ title, body, variant, onDismiss }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const iconConfig = ICON_VARIANT_CONFIG[variant];

  return (
    <View className="gap-4">
      <View className="flex-row justify-between items-center">
        <View
          className={`size-10 rounded-lg items-center justify-center ${iconConfig.containerClass}`}
        >
          {iconConfig.icon === "infoOctagon" ? (
            <Icon.InfoOctagon themeColor={iconConfig.themeColor} size={20} />
          ) : (
            <Icon.InfoCircle themeColor={iconConfig.themeColor} size={20} />
          )}
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          className="size-10 items-center justify-center rounded-full bg-gray-3"
        >
          <Icon.X color={themeColors.gray[9]} />
        </TouchableOpacity>
      </View>

      <View>
        <Text xl medium>
          {title}
        </Text>
      </View>

      <View className="gap-3">
        {body.map((paragraph) => (
          <Text key={paragraph} md regular secondary>
            {paragraph}
          </Text>
        ))}
      </View>

      <Button tertiary xl isFullWidth onPress={onDismiss}>
        {t("common.done")}
      </Button>
    </View>
  );
};

const MaintenanceBannerBottomSheet: React.FC<
  MaintenanceBannerBottomSheetProps
> = ({ modalRef, title, body, variant, onDismiss }) => (
  <BottomSheet
    modalRef={modalRef}
    handleCloseModal={onDismiss}
    bottomSheetModalProps={{
      onDismiss,
      enableDynamicSizing: true,
    }}
    customContent={
      <MaintenanceBannerBottomSheetContent
        title={title}
        body={body}
        variant={variant}
        onDismiss={onDismiss}
      />
    }
  />
);

export default MaintenanceBannerBottomSheet;
