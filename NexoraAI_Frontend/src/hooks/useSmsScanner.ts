import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { SmsModule } = NativeModules;

/**
 * useSmsScanner — thin wrapper around the native Android SmsModule.
 *
 * @param onSmsReceived  Callback fired when a new SMS arrives in real-time.
 *                       Receives { sender: string, body: string }.
 */
export const useSmsScanner = (
  onSmsReceived: (sms: { sender: string; body: string }) => void
) => {
  /**
   * Request READ_SMS + RECEIVE_SMS permissions.
   * Returns true if already granted, false if the permission dialog was shown.
   */
  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;
    return await SmsModule.requestSmsPermission();
  };

  /**
   * Load the last 50 inbox messages via the native content resolver.
   * Returns an array of { sender, body, date } objects.
   */
  const loadInbox = async (): Promise<{ sender: string; body: string; date: string }[]> => {
    if (Platform.OS !== 'android') return [];
    return await SmsModule.getSmsInbox();
  };

  /**
   * Start listening for real-time incoming SMS via BroadcastReceiver.
   * Returns a cleanup function — call it on unmount.
   */
  const startListening = (): (() => void) => {
    if (Platform.OS !== 'android') return () => {};
    const emitter = new NativeEventEmitter(SmsModule);
    const sub = emitter.addListener('onSmsReceived', onSmsReceived);
    return () => sub.remove();
  };

  return { requestPermission, loadInbox, startListening };
};
