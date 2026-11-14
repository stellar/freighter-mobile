import { images } from "assets/images";
import { ETHENA_LAUNCH_BANNER_COLORS } from "components/screens/EthenaLaunchScreen/ethenaLaunchConfig";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const CARD_PADDING = 16;
const CARD_RADIUS = 16;
const DISMISS_SIZE = 24;
const DISMISS_INSET = 13;
// The text stops this far short of the ✕.
const TEXT_GAP = 8;
// The glow's export is already clipped to the card: its right part, full height.
const GLOW_WIDTH = 203;
const DISMISS_HIT_SLOP = { top: 12, right: 12, bottom: 12, left: 12 };

const styles = StyleSheet.create({
  card: {
    backgroundColor: ETHENA_LAUNCH_BANNER_COLORS.background,
    borderRadius: pxValue(CARD_RADIUS),
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: pxValue(GLOW_WIDTH),
  },
  content: {
    padding: pxValue(CARD_PADDING),
  },
  text: {
    marginRight: pxValue(
      DISMISS_INSET + DISMISS_SIZE + TEXT_GAP - CARD_PADDING,
    ),
  },
  dismiss: {
    position: "absolute",
    top: pxValue(DISMISS_INSET),
    right: pxValue(DISMISS_INSET),
  },
  // An overlay rather than a border on the card, so nothing inside moves
  // between themes.
  outline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: pxValue(CARD_RADIUS),
    borderWidth: 1,
    borderColor: ETHENA_LAUNCH_BANNER_COLORS.darkModeOutline,
  },
});

interface EthenaLaunchBannerProps {
  onPress: () => void;
  onDismiss: () => void;
}

/**
 * Home's "Meet Ethena on Stellar" card, which opens the launch promo. The
 * same in both themes, except for a thin outline in dark mode so it stands
 * out on the black page.
 */
export const EthenaLaunchBanner: React.FC<EthenaLaunchBannerProps> = ({
  onPress,
  onDismiss,
}) => {
  const { t } = useAppTranslation();
  const isDarkMode = (useColorScheme() ?? DEFAULT_COLOR_SCHEME) === "dark";

  return (
    <View testID="ethena-launch-banner" style={styles.card}>
      <Image
        source={images.ethenaLaunchBannerGlow}
        style={styles.glow}
        resizeMode="stretch"
      />
      {/* Two sibling buttons, not one nested in the other, so a screen
          reader reaches both. */}
      <TouchableOpacity
        testID="ethena-launch-banner-open"
        style={styles.content}
        onPress={onPress}
        accessibilityRole="button"
      >
        <View testID="ethena-launch-banner-text" style={styles.text}>
          <Text lg semiBold color={ETHENA_LAUNCH_BANNER_COLORS.title}>
            {t("ethenaLaunchBanner.title")}
          </Text>
          <Text sm color={ETHENA_LAUNCH_BANNER_COLORS.subtitle}>
            {t("ethenaLaunchBanner.subtitle")}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        testID="ethena-launch-banner-dismiss"
        style={styles.dismiss}
        onPress={onDismiss}
        hitSlop={DISMISS_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={t("ethenaLaunchBanner.dismissAccessibilityLabel")}
      >
        <Icon.X
          size={pxValue(DISMISS_SIZE)}
          color={ETHENA_LAUNCH_BANNER_COLORS.dismiss}
        />
      </TouchableOpacity>
      {isDarkMode && (
        <View
          testID="ethena-launch-banner-outline"
          pointerEvents="none"
          style={styles.outline}
        />
      )}
    </View>
  );
};
