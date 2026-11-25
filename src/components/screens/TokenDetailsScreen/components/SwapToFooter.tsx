import { Button } from "components/sds/Button";
import { TextButton } from "components/sds/TextButton";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface SwapToFooterProps {
  tokenCode: string;
  /** "from" labels the button Swap from, for the source picker. Defaults to "to". */
  side?: "to" | "from";
  isFlagged: boolean;
  isMalicious: boolean;
  isPending: boolean;
  onSwapTo: () => void;
  onCancel: () => void;
}

/** The token details footer when the screen was opened from the swap amount screen or a swap picker. */
export const SwapToFooter: React.FC<SwapToFooterProps> = ({
  tokenCode,
  side = "to",
  isFlagged,
  isMalicious,
  isPending,
  onSwapTo,
  onCancel,
}) => {
  const { t } = useAppTranslation();

  if (!isFlagged) {
    return (
      <Button
        onPress={onSwapTo}
        secondary
        isLoading={isPending}
        testID="token-details-swap-to-button"
      >
        {side === "from"
          ? t("swapScreen.trendingDetail.swapFrom", { tokenCode })
          : t("swapScreen.trendingDetail.swapTo", { tokenCode })}
      </Button>
    );
  }

  return (
    <View className="gap-3">
      <Button
        secondary={!isMalicious}
        destructive={isMalicious}
        onPress={onCancel}
        isFullWidth
        testID="token-details-cancel-button"
      >
        {t("common.cancel")}
      </Button>
      <TextButton
        text={t("swapScreen.trendingDetail.swapToAnyway", { tokenCode })}
        onPress={onSwapTo}
        variant={isMalicious ? "error" : "secondary"}
        isLoading={isPending}
        testID="token-details-swap-to-anyway-button"
      />
    </View>
  );
};
