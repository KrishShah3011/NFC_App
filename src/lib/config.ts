import Constants from 'expo-constants';

const x = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

export const LINK_DOMAIN = String(x.linkDomain ?? 'nfc-app-prod.web.app');
export const SCHEME = String(x.scheme ?? 'nfcapp');
export const extra = {
  contactNotes: x.contactNotes === true,
  googleWebClientId: String(x.googleWebClientId ?? ''),
  adUnitNativeAndroid: String(x.adUnitNativeAndroid ?? ''),
  adUnitNativeIos: String(x.adUnitNativeIos ?? ''),
};

export const profileLink = (slug: string) => `https://${LINK_DOMAIN}/p/${slug}`;
