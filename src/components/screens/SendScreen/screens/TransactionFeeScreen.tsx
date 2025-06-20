import { NativeStackScreenProps } from "@react-navigation/native-stack";
import FeeSettings from "components/screens/shared/FeeSettings";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import React from "react";

type TransactionFeeScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_FEE_SCREEN
>;

/**
 * TransactionFeeScreen Component
 *
 * A wrapper screen for transaction fee configuration that uses the generic
 * fee screen component with transaction-specific store integration.
 *
 * @param {TransactionFeeScreenProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
const TransactionFeeScreen: React.FC<TransactionFeeScreenProps> = ({
  navigation,
}) => {
  const { transactionFee, saveTransactionFee } = useTransactionSettingsStore();

  const handleSave = (fee: string) => {
    saveTransactionFee(fee);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <FeeSettings
      currentFee={transactionFee}
      onSave={handleSave}
      onGoBack={handleGoBack}
    />
  );
};

export default TransactionFeeScreen;
