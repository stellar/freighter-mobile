import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { NavigationHeaderBar } from "components/layout/CustomNavigationHeader";
import { HeaderFade } from "components/layout/HeaderFade";
import MaintenanceBannerBottomSheet from "components/screens/HomeScreen/MaintenanceBannerBottomSheet";
import { NoticeBanner } from "components/sds/NoticeBanner";
import { AnalyticsEvent } from "config/analyticsConfig";
import { logger } from "config/logger";
import useAppTranslation from "hooks/useAppTranslation";
import { useAppUpdate } from "hooks/useAppUpdate";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useMaintenanceMode } from "hooks/useMaintenanceMode";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

/**
 * Home's header, drawn by the tab navigator: the shared nav bar with the
 * account switcher and the header buttons `useHomeHeaders` passes as
 * `headerLeft` and `headerRight`, on the header fade so Home's content
 * scrolls up under it. An update or maintenance banner shows under the bar,
 * and the header then stays solid.
 */
const HomeScreenHeader = (
  props: NativeStackHeaderProps | BottomTabHeaderProps,
) => {
  const { navigation, options = {} } = props;
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const { showBannerUpdateNotice, updateMessage, openAppStore } =
    useAppUpdate();
  const { showMaintenanceBanner, bannerContent } = useMaintenanceMode();
  const { open: openInBrowser } = useInAppBrowser();
  const maintenanceModalRef = useRef<BottomSheetModal>(null);
  const baseColor = themeColors.base[1];

  const handleBannerPress = useCallback(() => {
    openAppStore().then(() => {
      analytics.track(AnalyticsEvent.APP_UPDATE_STORE_OPENED, {
        source: "banner",
      });
    });
  }, [openAppStore]);

  const handleMaintenanceBannerPress = useCallback(() => {
    if (bannerContent.url) {
      let isValidHttpsUrl = false;
      try {
        isValidHttpsUrl = new URL(bannerContent.url).protocol === "https:";
      } catch (e) {
        logger.error(
          "HomeScreenHeader",
          "Malformed maintenance URL",
          bannerContent.url,
        );
        showToast({
          toastId: "maintenance-url-error",
          variant: "error",
          title: t("common.linkOpenError"),
        });
        return;
      }
      if (!isValidHttpsUrl) {
        logger.error(
          "HomeScreenHeader",
          "Blocked non-https maintenance URL",
          bannerContent.url,
        );
        showToast({
          toastId: "maintenance-url-error",
          variant: "error",
          title: t("common.linkOpenError"),
        });
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
  }, [bannerContent.url, bannerContent.modal, openInBrowser, showToast, t]);

  const handleModalDismiss = useCallback(() => {
    maintenanceModalRef.current?.dismiss();
  }, []);

  const buttonProps = {
    canGoBack: navigation.canGoBack(),
    tintColor: baseColor,
    pressColor: baseColor,
    pressOpacity: 0.5,
  };

  const hasMaintenanceBannerAction = !!(
    bannerContent.url || bannerContent.modal
  );

  const renderBannerContent = useCallback(() => {
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
  }, [
    showMaintenanceBanner,
    bannerContent,
    hasMaintenanceBannerAction,
    handleMaintenanceBannerPress,
    showBannerUpdateNotice,
    updateMessage,
    handleBannerPress,
  ]);

  const bannerContentNode = renderBannerContent();
  // Home's content scrolls up under the header and fades out below the row.
  // A banner is opaque, so with one the header stays solid instead of
  // showing content through the gap between the row and the banner.
  const hasFade = !bannerContentNode;

  return (
    <View className={hasFade ? undefined : "bg-base-0"}>
      {hasFade && <HeaderFade />}

      {/* Main header: the nav bar every other screen's header is drawn with,
          so Home's row lines up with theirs when the tabs switch */}
      <NavigationHeaderBar
        left={options.headerLeft?.(buttonProps)}
        right={options.headerRight?.(buttonProps)}
        isTransparent={hasFade}
      />

      {bannerContentNode}

      {/* Maintenance bottom sheet modal - shown when banner tapped with no URL */}
      {showMaintenanceBanner && bannerContent.modal && (
        <MaintenanceBannerBottomSheet
          modalRef={maintenanceModalRef}
          title={bannerContent.modal.title}
          body={bannerContent.modal.body}
          onDismiss={handleModalDismiss}
        />
      )}
    </View>
  );
};

export default HomeScreenHeader;
