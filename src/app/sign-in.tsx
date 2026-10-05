import {
  AppleAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Alert, Linking, Platform, Switch, View } from 'react-native';
import { Button, Field, Screen, T } from '@/components/ui';
import { extra, LINK_DOMAIN } from '@/lib/config';
import { recordConsent } from '@/lib/data';
import { auth } from '@/lib/firebase';

GoogleSignin.configure({ webClientId: extra.googleWebClientId });

export default function SignIn() {
  const [agreed, setAgreed] = useState(false);
  const [phone, setPhone] = useState('+91 ');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (!/cancel/i.test(msg)) Alert.alert('Sign-in failed', msg);
    } finally {
      setBusy(false);
    }
  };

  const google = run(async () => {
    await GoogleSignin.hasPlayServices();
    const r = await GoogleSignin.signIn();
    if (!isSuccessResponse(r) || !r.data.idToken) return;
    await signInWithCredential(auth, GoogleAuthProvider.credential(r.data.idToken));
    recordConsent();
  });

  const apple = run(async () => {
    const rawNonce = Crypto.randomUUID();
    const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const r = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce,
    });
    if (!r.identityToken) throw new Error('Apple returned no identity token.');
    await signInWithCredential(auth, AppleAuthProvider.credential(r.identityToken, rawNonce));
    recordConsent();
  });

  const sendCode = run(async () => setConfirm(await signInWithPhoneNumber(auth, phone.replace(/[\s-]/g, ''))));
  const verify = run(async () => {
    await confirm!.confirm(code.trim());
    recordConsent();
  });

  const off = !agreed || busy;
  return (
    <Screen>
      <View style={{ height: 48 }} />
      <T size={30} bold>
        Never lose a visiting card
      </T>
      <T muted>Capture any card — paper, QR, NFC or link — and find it later, even when you forget the name.</T>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
        <Switch value={agreed} onValueChange={setAgreed} accessibilityLabel="I am 18 or older and agree to the Privacy Policy and Terms" />
        <T size={14} style={{ flex: 1 }}>
          {"I'm 18 or older and agree to the Privacy Policy and Terms (links below)."}
        </T>
      </View>
      <Button kind="secondary" title="Read the Privacy Policy" onPress={() => Linking.openURL(`https://${LINK_DOMAIN}/privacy`)} />
      <Button kind="secondary" title="Read the Terms" onPress={() => Linking.openURL(`https://${LINK_DOMAIN}/terms`)} />

      {!confirm ? (
        <>
          <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          <Button title="Send code" onPress={sendCode} disabled={off || phone.replace(/\D/g, '').length < 10} />
        </>
      ) : (
        <>
          <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="sms-otp" maxLength={6} />
          <Button title="Verify" onPress={verify} disabled={off || code.trim().length !== 6} />
          <Button kind="secondary" title="Change number" onPress={() => setConfirm(null)} />
        </>
      )}

      <T muted style={{ textAlign: 'center' }}>
        or
      </T>
      <Button kind="secondary" title="Continue with Google" onPress={google} disabled={off} />
      {Platform.OS === 'ios' && (
        <View pointerEvents={off ? 'none' : 'auto'} style={{ opacity: off ? 0.4 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={{ height: 50 }}
            onPress={apple}
          />
        </View>
      )}
    </Screen>
  );
}
