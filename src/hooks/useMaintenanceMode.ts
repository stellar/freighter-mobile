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
 * Priority (highest to lowest, enforced in RootNavigator):
 *  - force update screen (required_app_version flag) — shown first, dismissible by the user
 *  - maintenance_screen — shown when services are degraded (visible once force update is dismissed)
 *  - maintenance_banner — takes precedence over the app update banner
 */
export const useMaintenanceMode = (): UseMaintenanceModeReturn => {
  const {
    maintenance_banner: maintenanceBanner,
    maintenance_screen: maintenanceScreen,
  } = useRemoteConfigStore();

  const bannerContent = maintenanceBannerContent(maintenanceBanner);
  const screenContent = maintenanceScreenContent(maintenanceScreen);

  const showMaintenanceBanner =
    maintenanceBanner.enabled &&
    !!maintenanceBanner.payload &&
    !!bannerContent.title;
  const showMaintenanceScreen =
    maintenanceScreen.enabled &&
    !!maintenanceScreen.payload &&
    !!screenContent.title;

  return {
    showMaintenanceBanner,
    showMaintenanceScreen,
    bannerContent,
    screenContent,
  };
};
