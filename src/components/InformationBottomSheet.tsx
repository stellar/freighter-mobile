import {
  BottomSheetHeader,
  BottomSheetHeaderLayout,
} from "components/BottomSheetHeader";
import { Button, ButtonVariant, ButtonVariants } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import React from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

/**
 * Props for the InformationBottomSheet component
 * @interface InformationBottomSheetProps
 * @property {() => void} [onConfirm] - Optional callback function for confirmation action (e.g., "Add Memo" button)
 * @property {() => void} onClose - Callback function when the bottom sheet is closed
 * @property {string} title - The main title displayed at the top of the bottom sheet
 * @property {BottomSheetHeaderLayout} [headerLayout] - Header layout. Defaults to `inline`
 * @property {Array<{ key: string; value: React.ReactNode }>} texts - Array of paragraphs to display. `value` accepts plain text or rich content (e.g. nested `<Text>` for inline emphasis); rendered inside the shared paragraph `<Text>` wrapper so RN's nested-Text inheritance keeps fonts consistent.
 * @property {string} [confirmLabel] - Optional label for the confirmation button (defaults to "Add memo")
 * @property {ButtonVariant} [confirmVariant] - Optional variant for the confirmation button (defaults to secondary)
 * @property {string} [confirmTestID] - Optional testID for the confirmation button.
 * @property {string} [closeTestID] - Optional testID for the close (X) button.
 */
type InformationBottomSheetProps = {
  onConfirm?: () => void;
  onClose: () => void;
  title: string;
  headerLayout?: BottomSheetHeaderLayout;
  texts: { key: string; value: React.ReactNode }[];
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  confirmTestID?: string;
  closeTestID?: string;
};

/**
 * InformationBottomSheet Component
 *
 * A reusable bottom sheet modal component designed to display informational content
 * with optional action buttons. Primarily used in the memo validation system to:
 * - Explain why memos are required for certain transactions
 * - Provide guidance on how to add required memos
 * - Display warnings and important information to users
 *
 * The component features:
 * - Shared header with a plain X
 * - Title section for main message
 * - Multiple text paragraphs for detailed information
 * - Optional confirmation button (typically "Add Memo" in memo validation context)
 * - Responsive layout with proper spacing and typography
 *
 * @param {InformationBottomSheetProps} props - Component props
 * @returns {JSX.Element} The rendered information bottom sheet
 */
const InformationBottomSheet = ({
  onConfirm,
  onClose,
  title,
  headerLayout,
  texts,
  confirmLabel,
  confirmVariant = ButtonVariants.SECONDARY,
  confirmTestID,
  closeTestID,
}: InformationBottomSheetProps) => {
  const { t } = useTranslation();

  return (
    <View className="flex-1">
      <BottomSheetHeader
        title={title}
        layout={headerLayout}
        onClose={onClose}
        closeTestID={closeTestID}
      />
      {texts.map((text) => (
        <View className="mt-[24px] pr-8" key={text.key}>
          <Text md regular secondary textAlign="left">
            {text.value}
          </Text>
        </View>
      ))}
      {onConfirm && (
        <View className="mt-[24px] gap-[12px] flex-row">
          <View className="flex-1">
            <Button
              onPress={onConfirm}
              variant={confirmVariant}
              xl
              testID={confirmTestID}
            >
              {confirmLabel ?? t("common.addMemo")}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
};

export default InformationBottomSheet;
