import BlockaidLogo from "assets/logos/blockaid-logo.svg";
import { List } from "components/List";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { BLOCKAID_FEEDBACK_URL } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View, Linking } from "react-native";
import { SecurityLevel } from "services/blockaid/constants";
import { SecurityWarning } from "services/blockaid/helper";

export interface SecurityDetailBottomSheetProps {
  warnings: SecurityWarning[];
  onCancel: () => void;
  onProceedAnyway: () => void;
  onClose: () => void;
  severity?: Exclude<SecurityLevel, SecurityLevel.SAFE>;
  /** The text to display for the "proceed anyway" button */
  proceedAnywayText: string;
}

/**
 * Reusable security detail bottom sheet component for displaying security warnings.
 * Can be used for both asset security warnings and dApp connection warnings.
 *
 * @example
 * // For Add Asset flow
 * <SecurityDetailBottomSheet
 *   warnings={warnings}
 *   onCancel={handleCancel}
 *   onProceedAnyway={handleProceed}
 *   onClose={handleClose}
 *   severity={SecurityLevel.MALICIOUS}
 *   proceedAnywayText={t("addAssetScreen.approveAnyway")}
 * />
 *
 * // For DApp Connection flow
 * <SecurityDetailBottomSheet
 *   warnings={warnings}
 *   onCancel={handleCancel}
 *   onProceedAnyway={handleProceed}
 *   onClose={handleClose}
 *   severity={SecurityLevel.SUSPICIOUS}
 *   proceedAnywayText={t("dappConnectionBottomSheetContent.connectAnyway")}
 * />
 */
export const SecurityDetailBottomSheet: React.FC<
  SecurityDetailBottomSheetProps
> = ({
  warnings,
  onCancel,
  onProceedAnyway,
  onClose,
  severity = SecurityLevel.MALICIOUS,
  proceedAnywayText,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const handleFeedback = () => {
    Linking.openURL(BLOCKAID_FEEDBACK_URL); // TODO: update this to use the backend feedback instead
  };

  const isMalicious = severity === SecurityLevel.MALICIOUS;

  const getHeaderIcon = () => {
    const baseClasses =
      "h-[40px] w-[40px] items-center justify-center rounded-[8px]";

    if (isMalicious) {
      return (
        <View className={`${baseClasses} bg-red-3 border border-red-6`}>
          <Icon.AlertOctagon themeColor="red" />
        </View>
      );
    }

    return (
      <View className={`${baseClasses} bg-amber-3 border border-amber-6`}>
        <Icon.AlertTriangle themeColor="amber" />
      </View>
    );
  };

  const getListItems = () =>
    warnings.map((warning) => ({
      title: warning.description,
      icon: isMalicious ? (
        <Icon.XCircle size={16} themeColor="red" />
      ) : (
        <Icon.MinusCircle size={16} themeColor="gray" />
      ),
    }));

  return (
    <View className="flex-1 gap-[16px]">
      <View className="flex-row justify-between items-center">
        {getHeaderIcon()}
        <View className="bg-background-tertiary rounded-full p-2 h-[32px] w-[32px] items-center justify-center">
          <Icon.XClose onPress={onClose} size={20} themeColor="gray" />
        </View>
      </View>
      <Text xl primary>
        {isMalicious
          ? t("securityWarning.doNotProceed")
          : t("securityWarning.suspiciousRequest")}
      </Text>
      <Text md secondary regular>
        {t("securityWarning.unsafeTransaction")}
      </Text>

      <View className="bg-background-tertiary rounded-2xl px-[16px] py-[12px] w-full gap-[12px]">
        <List
          items={getListItems()}
          hideDivider
          compact
          variant="transparent"
          className="w-full"
        />

        <View className="w-full border border-border-primary" />

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[6px]">
            <Text sm secondary>
              {t("securityWarning.poweredBy")}
            </Text>
            <BlockaidLogo />
            <Text sm secondary>
              {t("blockaid.brand")}
            </Text>
          </View>
          <Text sm color={themeColors.lilac[11]} onPress={handleFeedback}>
            {t("securityWarning.feedback")}
          </Text>
        </View>
      </View>

      <View className="gap-[12px]">
        <Button
          xl
          isFullWidth
          onPress={onCancel}
          variant={isMalicious ? "destructive" : "tertiary"}
        >
          {t("common.cancel")}
        </Button>
        <TextButton
          text={proceedAnywayText}
          onPress={onProceedAnyway}
          variant={isMalicious ? "error" : "secondary"}
        />
      </View>
    </View>
  );
};

export default SecurityDetailBottomSheet;
