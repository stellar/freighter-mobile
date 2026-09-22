import { OperationRecord } from "@stellar/stellar-sdk";
import Operations from "components/screens/SignTransactionDetails/components/Operations";
import React from "react";
import { View } from "react-native";

interface SignTransactionOperationDetailsProps {
  operations: OperationRecord[];
}

// Memoized because expanding or collapsing a sibling section re-renders this
// subtree, which would otherwise replay the operation list and its reveal
// delay. `useSignTransactionDetails` memoizes the array it passes, so the
// comparison actually holds for a given transaction -- and unlike the ref
// latch this replaces, a genuinely new transaction still renders.
const SignTransactionOperationDetails =
  React.memo<SignTransactionOperationDetailsProps>(({ operations }) => (
    <View className="flex-1">
      <Operations operations={operations} />
    </View>
  ));

export default SignTransactionOperationDetails;
