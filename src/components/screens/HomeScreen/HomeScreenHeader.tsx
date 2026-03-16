import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import {
  CustomHeaderButton,
  DEFAULT_HEADER_BUTTON_SIZE,
} from "components/layout/CustomHeaderButton";
import MaintenanceBannerBottomSheet from "components/screens/HomeScreen/MaintenanceBannerBottomSheet";
import { NoticeBanner } from "components/sds/NoticeBanner";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { DEFAULT_PADDING } from "config/constants";
import { logger } from "config/logger";
import { pxValue } from "helpers/dimensions";
import { useAppUpdate } from "hooks/useAppUpdate";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useMaintenanceMode } from "hooks/useMaintenanceMode";
import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { analytics } from "services/analytics";

const MIN_INSETS_TOP = 34;

const HomeScreenHeader = (
  props: NativeStackHeaderProps | BottomTabHeaderProps,
) => {
  const { navigation, options = {} } = props;
  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();
  const { showBannerUpdateNotice, updateMessage, openAppStore } =
    useAppUpdate();
  const { showMaintenanceBanner, bannerContent } = useMaintenanceMode();
  const { open: openInBrowser } = useInAppBrowser();
  const maintenanceModalRef = useRef<BottomSheetModal>(null);
  const baseColor = themeColors.base[1];

  const handleBannerPress = () => {
    openAppStore().then(() => {
      analytics.track(AnalyticsEvent.APP_UPDATE_OPEN_STORE_FROM_BANNER);
    });
  };

  const handleMaintenanceBannerPress = useCallback(() => {
    if (bannerContent.url) {
      let isValidHttpsUrl = false;
      try {
        isValidHttpsUrl = new URL(bannerContent.url).protocol === "https:";
      } catch {
        // malformed URL — do not open
      }
      if (!isValidHttpsUrl) {
        logger.error(
          "HomeScreenHeader",
          "Blocked non-https maintenance URL",
          bannerContent.url,
        );
        return;
      }
      openInBrowser(bannerContent.url).catch((error) => {
        logger.error(
          "HomeScreenHeader",
          "Failed to open maintenance URL",
          error,
        );
      });
    } else if (bannerContent.modal) {
      maintenanceModalRef.current?.present();
    }
  }, [bannerContent.url, bannerContent.modal, openInBrowser]);

  const handleModalDismiss = useCallback(() => {
    maintenanceModalRef.current?.dismiss();
  }, []);

  // In case insets.top is not available, let's ensure at least 34px of top
  // padding to avoid touching issues related to the notch and the status bar
  const insetsTop = insets.top || pxValue(MIN_INSETS_TOP - DEFAULT_PADDING);
  const paddingTop = insetsTop + pxValue(DEFAULT_PADDING);

  const hasMaintenanceBannerAction = !!(
    bannerContent.url || bannerContent.modal
  );

  const renderBannerContent = () => {
    if (showMaintenanceBanner) {
      return (
        <NoticeBanner
          text={bannerContent.title}
          variant={bannerContent.theme}
          onPress={
            hasMaintenanceBannerAction
              ? handleMaintenanceBannerPress
              : undefined
          }
        />
      );
    }

    if (showBannerUpdateNotice) {
      return <NoticeBanner text={updateMessage} onPress={handleBannerPress} />;
    }

    return null;
  };

  return (
    <View className="bg-background-primary">
      {/* Main header */}
      <View
        className="flex-row justify-between items-center px-6 pb-4"
        style={{ paddingTop }}
      >
        {options.headerLeft ? (
          options.headerLeft({
            canGoBack: navigation.canGoBack(),
            tintColor: baseColor,
            pressColor: baseColor,
            pressOpacity: 0.5,
          })
        ) : (
          <CustomHeaderButton position="left" />
        )}
        {typeof options.headerTitle === "string" && (
          <Text md primary semiBold>
            {options.headerTitle}
          </Text>
        )}
        {options.headerRight ? (
          options.headerRight({
            canGoBack: navigation.canGoBack(),
            tintColor: baseColor,
            pressColor: baseColor,
            pressOpacity: 0.5,
          })
        ) : (
          // Need to leave this empty view here to maintain the correct alignment of the header title
          <View className={DEFAULT_HEADER_BUTTON_SIZE} />
        )}
      </View>

      {renderBannerContent()}

      {/* Maintenance bottom sheet modal - shown when banner tapped with no URL */}
      {bannerContent.modal && (
        <MaintenanceBannerBottomSheet
          modalRef={maintenanceModalRef}
          title={bannerContent.modal.title}
          body={bannerContent.modal.body}
          variant={bannerContent.theme}
          onDismiss={handleModalDismiss}
        />
      )}
    </View>
  );
};

export default HomeScreenHeader;
