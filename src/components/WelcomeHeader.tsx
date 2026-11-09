import KeySwapIcon from "assets/icons/key-swap.svg";
import { VarialLogo } from "components/VarialLogo";
import { Display, Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useTheme from "hooks/useTheme";
import React from "react";
import { StyleSheet, View } from "react-native";

const LOGO_SIZE = 60;
const NOTICE_ICON_SIZE = 16;

// A StyleSheet rather than NativeWind classes: the SDS Display takes no
// className, so its overrides go through the style prop.
const styles = StyleSheet.create({
  // Figma: Funnel Sans Medium 32/40, tracking -1.28.
  title: {
    letterSpacing: -1.28,
    textAlign: "center",
  },
});

interface WelcomeHeaderProps {
  /** The greeting, e.g. "Welcome" or "Welcome back". */
  title: string;
}

/**
 * The Varial mark over a greeting and the "Freighter is now Varial" notice,
 * shared by the onboarding Welcome screen and the lock screen.
 *
 * Figma draws both screens from this one block, at the same height, so the
 * mark and the notice stay in place when Forgot password wipes the wallet
 * and the lock screen gives way to Welcome.
 *
 * Design: https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=1949-73267
 * (Welcome) and ?node-id=2554-154974 (lock screen).
 */
export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ title }) => {
  const { t } = useAppTranslation();
  const theme = useTheme();

  return (
    <View className="self-stretch items-center gap-[40px]">
      <VarialLogo width={LOGO_SIZE} height={LOGO_SIZE} />
      <View className="self-stretch gap-[8px]">
        <Display medium family="funnelSans" style={styles.title}>
          {title}
        </Display>
        <View className="flex-row items-center justify-center gap-[8px]">
          <KeySwapIcon
            width={pxValue(NOTICE_ICON_SIZE)}
            height={pxValue(NOTICE_ICON_SIZE)}
            color={theme.colors.foreground.primary}
          />
          <Text md medium secondary>
            {t("welcomeHeader.rebrandNotice")}
          </Text>
        </View>
      </View>
    </View>
  );
};
