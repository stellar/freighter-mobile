import { useRemoteConfigStore } from "ducks/remoteConfig";
import {
  maintenanceBannerContent,
  maintenanceScreenContent,
  type MaintenanceBannerContent,
  type MaintenanceScreenContent,
} from "helpers/maintenanceContent";

interface UseMaintenanceModeReturn {
  showMaintenanceBanner: boolean;
  showMaintenanceScreen: boolean;
  bannerContent: MaintenanceBannerContent;
  screenContent: MaintenanceScreenContent;
}

/**
 * Hook that reads maintenance feature flags from remote config and exposes
 * parsed, localized content for the maintenance banner and maintenance screen.
 *
 * Priority:
 *  - maintenance_screen takes precedence over all other banners/screens
 *  - maintenance_banner takes precedence over the app update banner
 */
export const useMaintenanceMode = (): UseMaintenanceModeReturn => {
  const {
    maintenance_banner: maintenanceBanner,
    maintenance_screen: maintenanceScreen,
  } = useRemoteConfigStore();

  const showMaintenanceBanner =
    maintenanceBanner.enabled && !!maintenanceBanner.payload;
  const showMaintenanceScreen =
    maintenanceScreen.enabled && !!maintenanceScreen.payload;

  const bannerContent = maintenanceBannerContent(maintenanceBanner);
  const screenContent = maintenanceScreenContent(maintenanceScreen);

  return {
    showMaintenanceBanner,
    showMaintenanceScreen,
    bannerContent,
    screenContent,
  };
};
