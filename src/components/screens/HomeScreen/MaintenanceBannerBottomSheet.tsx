import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface MaintenanceBannerBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  title: string;
  body: string[];
  onDismiss: () => void;
}

const MaintenanceBannerBottomSheetContent: React.FC<{
  title: string;
  body: string[];
  onDismiss: () => void;
}> = ({ title, body, onDismiss }) => {
  const { t } = useAppTranslation();

  return (
    <View className="gap-[24px]">
      <BottomSheetHeader
        title={title}
        onClose={onDismiss}
        closeTestID="maintenance-banner-close-button"
      />

      <View className="gap-3">
        {body.map((paragraph, index) => (
          // eslint-disable-next-line react/no-array-index-key --- static body. index as key is correct
          <Text key={index} md regular secondary>
            {paragraph}
          </Text>
        ))}
      </View>

      <Button secondary xl isFullWidth onPress={onDismiss}>
        {t("common.done")}
      </Button>
    </View>
  );
};

const MaintenanceBannerBottomSheet: React.FC<
  MaintenanceBannerBottomSheetProps
> = ({ modalRef, title, body, onDismiss }) => (
  <BottomSheet
    modalRef={modalRef}
    bottomSheetModalProps={{
      onDismiss,
      enableDynamicSizing: true,
    }}
    customContent={
      <MaintenanceBannerBottomSheetContent
        title={title}
        body={body}
        onDismiss={onDismiss}
      />
    }
  />
);

export default MaintenanceBannerBottomSheet;
