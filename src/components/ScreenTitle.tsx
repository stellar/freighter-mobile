import { OnboardTitle } from "components/layout/OnboardLayout";
import { Text } from "components/sds/Typography";
import React from "react";
import { View } from "react-native";

interface ScreenTitleProps {
  title: string;
  subtitle?: React.ReactNode;
  /** A muted subtitle, for explanatory copy. */
  isSubtitleSecondary?: boolean;
}

/**
 * The large left-aligned title the Varial designs open screens with
 * ("Heading/Screen", 32/40 medium Funnel Sans), under a header that carries
 * only the back or close button.
 */
const ScreenTitle: React.FC<ScreenTitleProps> = ({
  title,
  subtitle,
  isSubtitleSecondary = false,
}) => (
  <View className="gap-2 mb-6">
    <OnboardTitle>{title}</OnboardTitle>
    {subtitle ? (
      <Text md primary={!isSubtitleSecondary} secondary={isSubtitleSecondary}>
        {subtitle}
      </Text>
    ) : null}
  </View>
);

export default ScreenTitle;
