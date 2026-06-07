import BlockaidLogo from "assets/logos/blockaid-logo.svg";
import { List } from "components/List";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { BLOCKAID_FEEDBACK_URL } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useMemo } from "react";
import { View } from "react-native";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";
import { SecurityWarning } from "services/blockaid/helper";

export interface SecurityDetailBottomSheetProps {
  warnings: SecurityWarning[];
  onClose: () => void;
  securityContext?: SecurityContext;
  severity: Exclude<SecurityLevel, SecurityLevel.SAFE>;
}

export interface SecurityDetailFooterProps {
  onCancel?: () => void;
  onProceedAnyway?: () => void;
  /** The text to display for the "proceed anyway" button */
  proceedAnywayText: string;
  severity: Exclude<SecurityLevel, SecurityLevel.SAFE>;
}

/**
 * Reusable security detail bottom sheet body (header + warnings list).
 *
 * Designed to live inside a `<BottomSheet scrollable scrollViewFooterComponent={() => <SecurityDetailFooter ... />} />`
 * so the warnings list scrolls cleanly when long. Per-row icon is
 * driven by each warning's own `severity` field, not by this sheet's
 * sheet-level `severity` prop — the latter only drives the header
 * icon/copy.
 */
export const SecurityDetailBottomSheet: React.FC<
  SecurityDetailBottomSheetProps
> = ({
  warnings,
  onClose,
  securityContext = SecurityContext.TRANSACTION,
  severity,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { open: openInAppBrowser } = useInAppBrowser();

  const handleFeedback = () => {
    openInAppBrowser(BLOCKAID_FEEDBACK_URL); // TODO: update this to use the backend feedback instead
  };

  const isMalicious = severity === SecurityLevel.MALICIOUS;
  const isUnableToScan = severity === SecurityLevel.UNABLE_TO_SCAN;
  const isExpectedToFail = severity === SecurityLevel.EXPECTED_TO_FAIL;

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

    if (isUnableToScan) {
      return (
        <View className={`${baseClasses} bg-amber-3 border border-amber-6`}>
          <Icon.AlertCircle themeColor="amber" />
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
      // Stable React key — falling back to `title` (the description)
      // caused "Encountered two children with the same key" warnings
      // when source + destination produced the same feature_id.
      key: warning.id,
      title: warning.description,
      icon:
        warning.severity === "malicious" ? (
          <Icon.XCircle size={16} themeColor="red" />
        ) : (
          <Icon.AlertTriangle size={16} themeColor="amber" />
        ),
    }));

  const getDescription = useMemo(
    () => () => {
      if (isUnableToScan) {
        switch (securityContext) {
          case SecurityContext.TOKEN:
            return t("securityWarning.token");
          case SecurityContext.SITE:
            return t("blockaid.unableToScan.site.description");
          case SecurityContext.TRANSACTION:
            return t("securityWarning.unsafeTransaction");
          default:
            return t("blockaid.unableToScan.info");
        }
      }

      if (isExpectedToFail) {
        switch (securityContext) {
          case SecurityContext.TRANSACTION:
            return t("securityWarning.expectedToFailDescription");
          default:
            return t("securityWarning.expectedToFailDescription");
        }
      }

      switch (securityContext) {
        case SecurityContext.TOKEN:
          return t("securityWarning.token");
        case SecurityContext.SITE:
        case SecurityContext.TRANSACTION:
          return t("securityWarning.unsafeTransaction");

        default:
          return "";
      }
    },
    [securityContext, t, isUnableToScan, isExpectedToFail],
  );

  return (
    <View className="flex-1 gap-[16px]">
      <View className="flex-row justify-between items-center">
        {getHeaderIcon()}
        <View className="bg-background-tertiary rounded-full p-2 h-[32px] w-[32px] items-center justify-center">
          <Icon.XClose onPress={onClose} size={20} themeColor="gray" />
        </View>
      </View>
      <Text xl primary>
        {(() => {
          if (isMalicious) return t("securityWarning.doNotProceed");
          if (isUnableToScan) return t("securityWarning.proceedWithCaution");
          if (isExpectedToFail) return t("securityWarning.expectedToFailTitle");
          return t("securityWarning.suspiciousRequest");
        })()}
      </Text>
      <Text md secondary regular>
        {getDescription()}
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
    </View>
  );
};

/**
 * Action-buttons footer for the security-detail bottom sheet. Passed
 * to `<BottomSheet scrollViewFooterComponent={...} />` so the buttons
 * stay pinned while the warnings list scrolls.
 */
export const SecurityDetailFooter: React.FC<SecurityDetailFooterProps> = ({
  onCancel,
  onProceedAnyway,
  proceedAnywayText,
  severity,
}) => {
  const { t } = useAppTranslation();
  const isMalicious = severity === SecurityLevel.MALICIOUS;
  const isUnableToScan = severity === SecurityLevel.UNABLE_TO_SCAN;

  // Unable to scan state - side by side without biometrics
  if (isUnableToScan) {
    return (
      <View className="flex-row gap-3 px-6 pb-6 pt-3 bg-background-primary">
        {onCancel && (
          <View className="flex-1">
            <Button xl isFullWidth onPress={onCancel} variant="secondary">
              {t("common.cancel")}
            </Button>
          </View>
        )}
        {onProceedAnyway && (
          <View className="flex-1">
            <Button xl isFullWidth onPress={onProceedAnyway} variant="tertiary">
              {proceedAnywayText}
            </Button>
          </View>
        )}
      </View>
    );
  }

  // Malicious/Suspicious state - stacked layout with TextButton
  return (
    <View className="gap-[12px] px-6 pb-6 pt-3 bg-background-primary">
      {onCancel && (
        <Button
          xl
          isFullWidth
          onPress={onCancel}
          variant={isMalicious ? "destructive" : "tertiary"}
        >
          {t("common.cancel")}
        </Button>
      )}
      {onProceedAnyway && (
        <TextButton
          text={proceedAnywayText}
          onPress={onProceedAnyway}
          variant={isMalicious ? "error" : "secondary"}
        />
      )}
    </View>
  );
};

export default SecurityDetailBottomSheet;
