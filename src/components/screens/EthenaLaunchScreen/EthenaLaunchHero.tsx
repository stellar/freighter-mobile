import { images } from "assets/images";
import { ETHENA_LAUNCH_COLORS } from "components/screens/EthenaLaunchScreen/ethenaLaunchConfig";
import { useEthenaLaunchEntrance } from "components/screens/EthenaLaunchScreen/useEthenaLaunchEntrance";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import {
  Image,
  LayoutChangeEvent,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

// The wave's box is wider than the page and sits 23pt left of center, so the
// strokes sweep in from the left edge. Its bitmap fills the box: drawn as SVG,
// its ~200 gradient strokes took over a second to appear on 3x screens.
const WAVE_BOX = { width: 630, height: 355, top: 155, centerOffset: -23 };
const COINS_TOP = 180;
const COINS_BOX = { width: 306, height: 299 };
// The light coin is drawn first so the dark one overlaps it.
const LIGHT_COIN = { left: 108, top: 118, width: 198, height: 181 };
const DARK_COIN = { left: 0, top: 0, width: 238, height: 255 };
const CUE_ICON_SIZE = 18;

const styles = StyleSheet.create({
  waveBox: {
    position: "absolute",
    top: pxValue(WAVE_BOX.top),
    left: "50%",
    marginLeft: pxValue(WAVE_BOX.centerOffset - WAVE_BOX.width / 2),
    width: pxValue(WAVE_BOX.width),
    height: pxValue(WAVE_BOX.height),
  },
  // Explicit sizes: an Image otherwise keeps the asset's own size.
  waveArt: {
    width: "100%",
    height: "100%",
  },
  coinsRow: {
    paddingTop: pxValue(COINS_TOP),
    alignItems: "center",
  },
  coins: {
    width: pxValue(COINS_BOX.width),
    height: pxValue(COINS_BOX.height),
  },
  lightCoin: {
    position: "absolute",
    left: pxValue(LIGHT_COIN.left),
    top: pxValue(LIGHT_COIN.top),
    width: pxValue(LIGHT_COIN.width),
    height: pxValue(LIGHT_COIN.height),
  },
  darkCoin: {
    position: "absolute",
    left: pxValue(DARK_COIN.left),
    top: pxValue(DARK_COIN.top),
    width: pxValue(DARK_COIN.width),
    height: pxValue(DARK_COIN.height),
  },
  intro: {
    marginTop: pxValue(48),
    paddingHorizontal: pxValue(DEFAULT_PADDING),
    gap: pxValue(8),
  },
  title: {
    letterSpacing: -1.28,
    textAlign: "center",
  },
  // Pushes the cue to the bottom of the first screen when there's room, and
  // lets it follow the intro instead of overlapping it when there isn't,
  // still a default gap away on the shortest screens.
  spacer: {
    flex: 1,
    minHeight: pxValue(DEFAULT_PADDING),
  },
  cue: {
    alignItems: "center",
    marginBottom: pxValue(64),
  },
  cueButton: {
    alignItems: "center",
    gap: pxValue(8),
  },
});

interface EthenaLaunchHeroProps {
  onCuePress: () => void;
  /** The cue's y within the hero, which starts the scroll content. */
  onCueLayout: (y: number) => void;
}

/**
 * The promo's first screen: the wave and coins, the title and subtitle, and
 * the scroll cue at the bottom. At least one screen tall.
 */
export const EthenaLaunchHero: React.FC<EthenaLaunchHeroProps> = ({
  onCuePress,
  onCueLayout,
}) => {
  const { t } = useAppTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const { waveStyle, coinsStyle, introStyle, cueStyle } =
    useEthenaLaunchEntrance();

  return (
    <View testID="ethena-launch-hero" style={{ minHeight: windowHeight }}>
      <Animated.View
        style={[styles.waveBox, waveStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Image
          testID="ethena-launch-wave"
          source={images.ethenaLaunchWave}
          style={styles.waveArt}
        />
      </Animated.View>

      <Animated.View
        style={[styles.coinsRow, coinsStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.coins}>
          <Image
            source={images.ethenaLaunchCoinLight}
            resizeMode="cover"
            style={styles.lightCoin}
          />
          <Image source={images.ethenaLaunchCoinDark} style={styles.darkCoin} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.intro, introStyle]}>
        <Display
          sm
          medium
          family="funnelSans"
          color={ETHENA_LAUNCH_COLORS.textPrimary}
          style={styles.title}
        >
          {t("ethenaLaunchScreen.title")}
        </Display>
        <Text md color={ETHENA_LAUNCH_COLORS.textSecondary} textAlign="center">
          {t("ethenaLaunchScreen.subtitle")}
        </Text>
      </Animated.View>

      <View testID="ethena-launch-cue-spacer" style={styles.spacer} />

      {/* The fade sits on a wrapper: TouchableOpacity animates its own
          opacity on press and would override it. */}
      <Animated.View
        style={[styles.cue, cueStyle]}
        onLayout={(event: LayoutChangeEvent) =>
          onCueLayout(event.nativeEvent.layout.y)
        }
      >
        <TouchableOpacity
          testID="ethena-launch-cue"
          style={styles.cueButton}
          onPress={onCuePress}
          accessibilityRole="button"
        >
          <Text md medium color={ETHENA_LAUNCH_COLORS.textSecondary}>
            {t("ethenaLaunchScreen.scrollCue")}
          </Text>
          <Icon.ChevronDown
            size={pxValue(CUE_ICON_SIZE)}
            color={ETHENA_LAUNCH_COLORS.icon}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};
