import { Operation } from "@stellar/stellar-sdk";
import Operations from "components/screens/SignTransactionDetails/components/Operations";
import React, { useRef } from "react";
import { View } from "react-native";

interface SignTransactionOperationDetailsProps {
  operations: Operation[];
}

const SignTransactionOperationDetails =
  React.memo<SignTransactionOperationDetailsProps>(({ operations }) => {
    const stableOperationsRef = useRef<Operation[]>([]);
    const hasInitializedRef = useRef(false);

    // Only set operations ONCE, never update them
    // to avoid re-rendering issues due to collapsible sections layout effect
    if (!hasInitializedRef.current) {
      stableOperationsRef.current = operations;
      hasInitializedRef.current = true;
    }

    return (
      <View className="flex-1">
        <Operations operations={stableOperationsRef.current || []} />
      </View>
    );
  });

export default SignTransactionOperationDetails;
