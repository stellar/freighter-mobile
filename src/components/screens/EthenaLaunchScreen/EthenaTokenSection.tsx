import {
  ETHENA_LAUNCH_COLORS,
  EthenaLaunchToken,
} from "components/screens/EthenaLaunchScreen/ethenaLaunchConfig";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { StyleSheet, View } from "react-native";

const LOGO_SIZE = 48;

const styles = StyleSheet.create({
  section: {
    padding: pxValue(DEFAULT_PADDING),
    gap: pxValue(24),
  },
  info: {
    gap: pxValue(8),
  },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: pxValue(16),
  },
  headingText: {
    flex: 1,
  },
  actions: {
    gap: pxValue(8),
  },
});

interface EthenaTokenSectionProps {
  token: EthenaLaunchToken;
  name: string;
  description: string;
  /** Swap goes through Discover, so it's left out while Discover is off. */
  canSwap: boolean;
  onSwap: (token: EthenaLaunchToken) => void;
  onReceive: (token: EthenaLaunchToken) => void;
}

/** One token on the promo: its logo, code, name and description, then Swap and Receive. */
export const EthenaTokenSection: React.FC<EthenaTokenSectionProps> = ({
  token,
  name,
  description,
  canSwap,
  onSwap,
  onReceive,
}) => {
  const { t } = useAppTranslation();
  const { Logo } = token;

  return (
    <View style={styles.section}>
      <View style={styles.info}>
        <View style={styles.heading}>
          {/* Decorative: the code beside it names the token. */}
          <Logo width={pxValue(LOGO_SIZE)} height={pxValue(LOGO_SIZE)} />
          <View style={styles.headingText}>
            <Text xl semiBold color={ETHENA_LAUNCH_COLORS.textPrimary}>
              {token.code}
            </Text>
            <Text sm medium color={ETHENA_LAUNCH_COLORS.textSecondary}>
              {name}
            </Text>
          </View>
        </View>
        <Text sm medium color={ETHENA_LAUNCH_COLORS.textSecondary}>
          {description}
        </Text>
      </View>

      <View style={styles.actions}>
        {canSwap && (
          <Button
            secondary
            xl
            isFullWidth
            colorScheme="dark"
            onPress={() => onSwap(token)}
            testID={`ethena-launch-swap-${token.id}`}
          >
            {t("ethenaLaunchScreen.swapTo", { code: token.code })}
          </Button>
        )}
        <Button
          tertiary
          xl
          isFullWidth
          colorScheme="dark"
          onPress={() => onReceive(token)}
          testID={`ethena-launch-receive-${token.id}`}
        >
          {t("ethenaLaunchScreen.receive", { code: token.code })}
        </Button>
      </View>
    </View>
  );
};
