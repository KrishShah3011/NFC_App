import { Platform } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

/** Writes the link as one NDEF URI record; the tag is left unlocked (spec §7.2). */
export async function writeTag(url: string): Promise<'written' | 'cancelled' | { error: string }> {
  if (!(await NfcManager.isSupported())) return { error: 'This phone has no NFC.' };
  await NfcManager.start();
  if (Platform.OS === 'android' && !(await NfcManager.isEnabled())) return { error: 'Turn on NFC in Settings, then try again.' };
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: 'Hold the top of your phone near the tag' });
    await NfcManager.ndefHandler.writeNdefMessage(Ndef.encodeMessage([Ndef.uriRecord(url)]));
    if (Platform.OS === 'ios') await NfcManager.setAlertMessageIOS('Done');
    return 'written';
  } catch (e) {
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return 'cancelled';
    return { error: "Couldn't write the tag. It may be locked, too small, or not NDEF-formatted." };
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
