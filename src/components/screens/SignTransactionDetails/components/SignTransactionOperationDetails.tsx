import { Operation } from "@stellar/stellar-sdk";
import Operations from "components/screens/SignTransactionDetails/components/Operations";
import React from "react";
import { View } from "react-native";

interface SignTransactionOperationDetailsProps {
  operations: Operation[];
}

const SignTransactionOperationDetails = ({
  operations,
}: SignTransactionOperationDetailsProps) => (
  <View>
    <Operations operations={operations} />
  </View>
);

export default SignTransactionOperationDetails;
