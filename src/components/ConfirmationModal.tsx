import Modal from "components/Modal";
import { Button, IconPosition } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import React from "react";
import { View } from "react-native";

/**
 * Props for the ConfirmationModal component
 */
interface ConfirmationModalProps {
  /** Whether the modal is currently visible */
  visible: boolean;
  /** Function to call when the modal should be closed */
  onClose: () => void;
  /** Title text displayed at the top of the modal */
  title: string;
  /** Message text displayed below the title */
  message: string;
  /** Text for the confirm/primary action button */
  confirmText?: string;
  /** Text for the cancel/secondary action button */
  cancelText?: string;
  /** Function to call when the confirm button is pressed */
  onConfirm: () => void;
  /** Optional function to call when the cancel button is pressed */
  onCancel?: () => void;
  /** Whether to show a loading state on the confirm button */
  isLoading?: boolean;
  /** Whether to use destructive styling for the confirm button */
  destructive?: boolean;
  /** Whether to show a loading state on the confirm button */
  cancelButtonIcon?: React.ReactNode;
  /** Whether to use destructive styling for the confirm button */
  cancelButtonIconPosition?: IconPosition;
  /** Whether to use destructive styling for the confirm button */
  confirmButtonIcon?: React.ReactNode;
  /** Whether to use destructive styling for the confirm button */
  confirmButtonIconPosition?: IconPosition;
  /** Whether to use biometric confirmation for the confirm button */
  biometricConfirm?: boolean;
}

/**
 * ConfirmationModal Component
 *
 * A modal dialog that presents users with a confirmation action and two options:
 * confirm (primary action) and cancel (secondary action). This component is commonly
 * used for confirming destructive actions, enabling/disabling features, or any
 * operation that requires explicit user consent.
 *
 * The modal includes:
 * - A title and descriptive message
 * - Two action buttons (confirm and cancel)
 * - Optional loading states and destructive styling
 * - Automatic closing after actions are performed
 *
 * @example
 * Basic usage:
 * ```tsx
 * <ConfirmationModal
 *   visible={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Delete Account"
 *   message="Are you sure you want to delete your account? This action cannot be undone."
 *   confirmText="Delete"
 *   onConfirm={handleDeleteAccount}
 * />
 * ```
 *
 * @example
 * With custom cancel handler and destructive styling:
 * ```tsx
 * <ConfirmationModal
 *   visible={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Disable Biometrics"
 *   message="This will remove biometric authentication from your wallet."
 *   confirmText="Disable"
 *   cancelText="Keep Enabled"
 *   onConfirm={handleDisableBiometrics}
 *   onCancel={handleKeepBiometrics}
 *   destructive
 * />
 * ```
 *
 * @example
 * With loading state:
 * ```tsx
 * <ConfirmationModal
 *   visible={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Processing Payment"
 *   message="Please wait while we process your payment..."
 *   confirmText="Processing..."
 *   onConfirm={handlePayment}
 *   isLoading
 * />
 * ```
 *
 * @param props - Component props
 * @param props.visible - Whether the modal is currently visible
 * @param props.onClose - Function to call when the modal should be closed
 * @param props.title - Title text displayed at the top of the modal
 * @param props.message - Message text displayed below the title
 * @param props.confirmText - Text for the confirm button (defaults to "common.confirm")
 * @param props.cancelText - Text for the cancel button (defaults to "common.cancel")
 * @param props.onConfirm - Function to call when the confirm button is pressed
 * @param props.onCancel - Optional function to call when the cancel button is pressed
 * @param props.isLoading - Whether to show loading state on confirm button (defaults to false)
 * @param props.destructive - Whether to use destructive styling for confirm button (defaults to false)
 * @returns React component for confirmation modal dialog
 */
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  onClose,
  title,
  message,
  confirmText = "common.confirm",
  cancelText = "common.cancel",
  onConfirm,
  onCancel,
  isLoading = false,
  destructive = false,
  cancelButtonIcon,
  cancelButtonIconPosition,
  confirmButtonIcon,
  confirmButtonIconPosition,
  biometricConfirm = false,
}) => {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <Text xl regular>
        {title}
      </Text>
      <View className="mt-4">
        <Text md regular secondary>
          {message}
        </Text>
      </View>
      <View className="h-8" />
      <View className="flex-row justify-between w-full gap-3">
        <View className="flex-1">
          <Button
            secondary
            icon={cancelButtonIcon}
            iconPosition={cancelButtonIconPosition}
            isFullWidth
            onPress={handleCancel}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            icon={confirmButtonIcon}
            iconPosition={confirmButtonIconPosition}
            destructive={destructive}
            isFullWidth
            onPress={handleConfirm}
            isLoading={isLoading}
            biometric={biometricConfirm}
          >
            {confirmText}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default ConfirmationModal;
