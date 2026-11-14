import { images } from "assets/images";
import EthenaLaunchWave from "assets/images/ethena-launch-wave.svg";
import { ETHENA_LAUNCH_COLORS } from "components/screens/EthenaLaunchScreen/ethenaLaunchConfig";
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

// The wave is drawn wider than the page and clipped to its box; the box sits
// 23pt left of center so the strokes sweep in from the left edge.
const WAVE_BOX = { width: 630, height: 355, top: 155, centerOffset: -23 };
const WAVE_ART = {
  width: 927.235,
  height: 561.721,
  left: -193.03,
  top: -96.35,
};
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
    overflow: "hidden",
  },
  waveArt: {
    position: "absolute",
    left: pxValue(WAVE_ART.left),
    top: pxValue(WAVE_ART.top),
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
  // lets it follow the intro instead of overlapping it when there isn't.
  spacer: {
    flex: 1,
  },
  cue: {
    alignItems: "center",
    gap: pxValue(8),
    marginBottom: pxValue(64),
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

  return (
    <View testID="ethena-launch-hero" style={{ minHeight: windowHeight }}>
      <View
        style={styles.waveBox}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <EthenaLaunchWave
          width={pxValue(WAVE_ART.width)}
          height={pxValue(WAVE_ART.height)}
          style={styles.waveArt}
        />
      </View>

      <View
        style={styles.coinsRow}
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
      </View>

      <View style={styles.intro}>
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
      </View>

      <View style={styles.spacer} />

      <TouchableOpacity
        testID="ethena-launch-cue"
        style={styles.cue}
        onPress={onCuePress}
        onLayout={(event: LayoutChangeEvent) =>
          onCueLayout(event.nativeEvent.layout.y)
        }
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
    </View>
  );
};
