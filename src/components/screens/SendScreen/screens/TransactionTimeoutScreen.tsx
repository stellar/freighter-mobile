import { NativeStackScreenProps } from "@react-navigation/native-stack";
import TimeoutSettings from "components/screens/shared/TimeoutSettings";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import React from "react";

type TransactionTimeoutScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_TIMEOUT_SCREEN
>;

/**
 * TransactionTimeoutScreen Component
 *
 * A wrapper screen for transaction timeout configuration that uses the generic
 * timeout screen component with transaction-specific store integration.
 *
 * @param {TransactionTimeoutScreenProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
const TransactionTimeoutScreen: React.FC<TransactionTimeoutScreenProps> = ({
  navigation,
}) => {
  const { transactionTimeout, saveTransactionTimeout } =
    useTransactionSettingsStore();

  const handleSave = (timeout: number) => {
    saveTransactionTimeout(timeout);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <TimeoutSettings
      currentTimeout={transactionTimeout}
      onSave={handleSave}
      onGoBack={handleGoBack}
    />
  );
};

export default TransactionTimeoutScreen;
