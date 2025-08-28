import Icon from "components/sds/Icon";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";

interface CollapsibleSectionProps {
  /** Content to display in the header when collapsed/expanded */
  header: React.ReactNode;
  /** Content to display when the section is expanded */
  children: React.ReactNode;
  /** Whether the section should be expanded by default */
  defaultExpanded?: boolean;
  /** Optional test ID for testing purposes */
  testID?: string;
}

/**
 * A collapsible section component that toggles content visibility with chevron icons.
 *
 * Features:
 * - Independent state management for each instance
 * - Accessible with proper ARIA attributes
 * - Smooth visual feedback with chevron rotation
 * - TouchableOpacity header area for intuitive interaction
 *
 * @example
 * ```tsx
 * <CollapsibleSection
 *   header={
 *     <View className="flex-row items-center gap-[8px]">
 *       <Icon.CodeCircle01 size={16} themeColor="gray" />
 *       <Text>Function Name</Text>
 *     </View>
 *   }
 * >
 *   <Text>Detailed content here</Text>
 * </CollapsibleSection>
 * ```
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  header,
  children,
  defaultExpanded = false,
  testID,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <View testID={testID}>
      <TouchableOpacity
        onPress={toggleExpanded}
        className="flex-row items-center justify-between"
      >
        {header}
        {!isExpanded ? (
          <Icon.ChevronRight size={16} themeColor="gray" />
        ) : (
          <Icon.ChevronDown size={16} themeColor="gray" />
        )}
      </TouchableOpacity>
      {isExpanded && <View>{children}</View>}
    </View>
  );
};

export default CollapsibleSection;
