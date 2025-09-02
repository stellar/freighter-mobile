import { QRCodeSource } from "config/constants";
import { create } from "zustand";

interface QRDataState {
  /** The scanned QR code data */
  scannedData: string | null;
  /** Source/context of where the QR code was scanned from */
  source: QRCodeSource | null;
  /** Whether the QR data has been consumed */
  isConsumed: boolean;
}

interface QRDataActions {
  /** Set the scanned QR data */
  setScannedData: (data: string, source: QRCodeSource) => void;
  /** Mark the QR data as consumed and clear it */
  consumeQRData: () => void;
  /** Clear all QR data */
  clearQRData: () => void;
}

type QRDataStore = QRDataState & QRDataActions;

const initialState: QRDataState = {
  scannedData: null,
  source: null,
  isConsumed: false,
};

export const useQRDataStore = create<QRDataStore>((set) => ({
  ...initialState,

  setScannedData: (data: string, source: QRCodeSource) =>
    set({
      scannedData: data,
      source,
      isConsumed: false,
    }),

  consumeQRData: () =>
    set((state) => ({
      scannedData: state.scannedData,
      source: state.source,
      isConsumed: true,
    })),

  clearQRData: () => set(initialState),
}));
