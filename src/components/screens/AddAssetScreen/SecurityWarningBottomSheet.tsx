import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BLOCKAID_FEEDBACK_URL } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View, TouchableOpacity, Linking } from "react-native";

export interface SecurityWarning {
  id: string;
  title: string;
  description: string;
}

interface SecurityWarningBottomSheetProps {
  warnings: SecurityWarning[];
  onCancel: () => void;
  onProceedAnyway: () => void;
  onClose: () => void;
  severity?: "malicious" | "suspicious";
}

const SecurityWarningBottomSheet: React.FC<SecurityWarningBottomSheetProps> = ({
  warnings,
  onCancel,
  onProceedAnyway,
  onClose,
  severity = "malicious",
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const handleFeedback = () => {
    Linking.openURL(BLOCKAID_FEEDBACK_URL);
  };

  const isMalicious = severity === "malicious";
  const alertColor = isMalicious
    ? themeColors.status.error
    : themeColors.status.warning;
  const alertBackground = isMalicious
    ? themeColors.red[3]
    : themeColors.amber[3];

  return (
    <View className="flex-1 bg-background-primary">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <View
            className="rounded-lg p-2 mr-3"
            style={{ backgroundColor: alertBackground }}
          >
            <Icon.AlertOctagon
              size={24}
              color={isMalicious ? themeColors.status.error : alertColor}
            />
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="w-8 h-8 rounded-full bg-background-tertiary items-center justify-center"
        >
          <Icon.X size={16} color={themeColors.foreground.primary} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View className="mb-4">
        <Text xl primary bold>
          {t("addAssetScreen.securityWarning.doNotProceed")}
        </Text>
      </View>
      <View className="mb-4">
        <Text md secondary>
          {t("addAssetScreen.securityWarning.unsafeTransaction")}
        </Text>
      </View>

      {/* Warning Reasons */}
      <View className="px-6 py-4 bg-background-tertiary rounded-xl mb-6">
        {warnings.map((warning) => (
          <View key={warning.id} className="flex-row items-center mb-3">
            <View
              className="w-5 h-5 rounded-full items-center justify-center mr-3"
              style={{ borderWidth: 1, borderColor: alertColor }}
            >
              <Icon.X size={10} color={alertColor} />
            </View>
            <Text md primary>
              {warning.title}
            </Text>
          </View>
        ))}

        {/* Separator */}
        <View
          className="h-px w-full my-2"
          style={{ backgroundColor: themeColors.gray[6] }}
        />

        {/* Powered by Blockaid */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text sm secondary>
              {t("addAssetScreen.securityWarning.poweredBy")}
            </Text>
            <View className="ml-2">
              <Text sm primary bold>
                Blockaid
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleFeedback}>
            <Text sm style={{ color: themeColors.lilac[11] }}>
              {t("addAssetScreen.securityWarning.feedback")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="px-6">
        <View className="mb-4">
          <Button
            secondary={!isMalicious}
            destructive={isMalicious}
            lg
            isFullWidth
            onPress={onCancel}
          >
            {t("common.cancel")}
          </Button>
        </View>

        <TouchableOpacity onPress={onProceedAnyway} className="items-center">
          <Text
            md
            style={{
              color: isMalicious
                ? themeColors.status.error
                : themeColors.foreground.secondary,
              fontWeight: "bold",
            }}
          >
            {t("addAssetScreen.securityWarning.connectAnyway")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SecurityWarningBottomSheet;
