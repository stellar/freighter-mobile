import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";

/**
 * Props for the InformationBottomSheet component
 * @interface InformationBottomSheetProps
 * @property {() => void} [onConfirm] - Optional callback function for confirmation action (e.g., "Add Memo" button)
 * @property {() => void} onClose - Callback function when the bottom sheet is closed
 * @property {string} title - The main title displayed at the top of the bottom sheet
 * @property {React.ReactNode} [headerElement] - Optional custom header element (e.g., icon with background)
 * @property {Array<{ key: string; value: string }>} texts - Array of text strings to display as content paragraphs
 */
type InformationBottomSheetProps = {
  onConfirm?: () => void;
  onClose: () => void;
  title: string;
  headerElement?: React.ReactNode;
  texts: { key: string; value: string }[];
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
 * - Custom header with optional icon/element and close button
 * - Title section for main message
 * - Multiple text paragraphs for detailed information
 * - Optional confirmation button (typically "Add Memo" in memo validation context)
 * - Responsive layout with proper spacing and typography
 *
 * @param {InformationBottomSheetProps} props - Component props
 * @returns {JSX.Element} The rendered information bottom sheet
 *
 * @example
 * ```tsx
 * // Basic usage for memo explanation
 * <InformationBottomSheet
 *   title="Memo is required"
 *   texts={[
 *     "Some destination accounts require a memo to identify your payment.",
 *     "Without a memo, your funds may not reach the intended recipient."
 *   ]}
 *   onClose={() => setShowExplanation(false)}
 *   onConfirm={() => handleAddMemo()}
 *   headerElement={
 *     <View className="bg-red-3 p-2 rounded-[8px]">
 *       <Icon.InfoOctagon color={themeColors.status.error} size={28} />
 *     </View>
 *   }
 * />
 *
 * // Usage without confirmation button
 * <InformationBottomSheet
 *   title="Transaction Information"
 *   texts={["This is informational content only."]}
 *   onClose={() => setShowInfo(false)}
 * />
 * ```
 */
const InformationBottomSheet = ({
  onConfirm,
  onClose,
  title,
  headerElement,
  texts,
}: InformationBottomSheetProps) => {
  const { themeColors } = useColors();

  const { t } = useTranslation();

  return (
    <View className="flex-1">
      <View className="relative flex-row items-center mb-8">
        {headerElement}
        <TouchableOpacity onPress={onClose} className="absolute right-0">
          <Icon.X
            color={themeColors.foreground.secondary}
            size={24}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>
      <View>
        <Text xl medium primary textAlign="left">
          {title}
        </Text>
      </View>
      {texts.map((text) => (
        <View className="mt-[24px] pr-8" key={text.key}>
          <Text md medium secondary textAlign="left">
            {text.value}
          </Text>
        </View>
      ))}
      {onConfirm && (
        <View className="mt-[24px] gap-[12px] flex-row">
          <View className="flex-1">
            <Button onPress={onConfirm} tertiary xl>
              {t("common.addMemo")}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
};

export default InformationBottomSheet;
