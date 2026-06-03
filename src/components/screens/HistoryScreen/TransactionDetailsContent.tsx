import React from "react";
import { View } from "react-native";

interface TransactionDetailsContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for transaction details content
 */
const TransactionDetailsContent: React.FC<TransactionDetailsContentProps> = ({
  children,
  className,
}) => (
  <View className={`bg-background-tertiary rounded-2xl p-6 gap-3 ${className}`}>
    {children}
  </View>
);

export default TransactionDetailsContent;
