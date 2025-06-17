import { TransactionStatus } from "components/screens/SwapScreen/helpers";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";

export const useTransactionStatus = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  
  const { 
    transactionHash, 
    error: transactionError, 
    isSubmitting 
  } = useTransactionBuilderStore();

  const getStatus = (): TransactionStatus => {
    if (transactionHash) return TransactionStatus.SUCCESS;
    if (transactionError) return TransactionStatus.FAILED;
    if (isSubmitting) return TransactionStatus.SUBMITTING;
    return TransactionStatus.SUCCESS; // Default for completed transactions
  };

  const status = getStatus();

  const getStatusText = () => {
    switch (status) {
      case TransactionStatus.SUCCESS:
        return t("transactionDetailsBottomSheet.statusSuccess");
      case TransactionStatus.FAILED:
        return t("transactionDetailsBottomSheet.statusFailed");
      case TransactionStatus.SUBMITTING:
      case TransactionStatus.PENDING:
        return t("transactionDetailsBottomSheet.statusPending");
      default:
        return t("transactionDetailsBottomSheet.statusSuccess");
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case TransactionStatus.SUCCESS:
        return themeColors.status.success;
      case TransactionStatus.FAILED:
        return themeColors.status.error;
      case TransactionStatus.SUBMITTING:
      case TransactionStatus.PENDING:
        return themeColors.status.warning;
      default:
        return themeColors.status.success;
    }
  };

  return {
    status,
    statusText: getStatusText(),
    statusColor: getStatusColor(),
    transactionHash,
    transactionError,
    isSubmitting
  };
}; 