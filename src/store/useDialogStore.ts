// eslint-disable-next-line no-restricted-imports -- the one sanctioned use: the phone keeps the system dialog
import { Alert, Platform, type AlertButton } from 'react-native';
import { create } from 'zustand';

/**
 * The app's dialogs (confirmations and messages). On the phone they are the system's (`Alert.alert`). React
 * Native for Web has no alert (it does nothing), so in the web build (0.6.0) the same call opens TangTu's own
 * dialog (`DialogHost`): a delete would otherwise neither ask nor happen. Use `showAlert`, never `Alert.alert`
 * (ESLint stops the import).
 */
export interface Dialog {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface DialogState {
  dialog: Dialog | null;
  /** Closes the dialog; the button's `onPress` (if any) runs after it is gone. */
  close: (id: number, button?: AlertButton) => void;
}

let nextId = 1;

export const useDialogStore = create<DialogState>()((set, get) => ({
  dialog: null,
  close: (id, button) => {
    if (get().dialog?.id !== id) return;
    set({ dialog: null });
    button?.onPress?.();
  },
}));

/** Same arguments as `Alert.alert`. With no buttons there is one "OK". */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  useDialogStore.setState({ dialog: { id: nextId++, title, message, buttons: buttons ?? [] } });
}
