import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { NativeAd, NativeAdView, NativeAsset, NativeAssetType, TestIds } from 'react-native-google-mobile-ads';
import { adsEnabled } from '@/lib/ads';
import { extra } from '@/lib/config';
import { useData } from '@/lib/store';
import { useTheme } from './ui';

const UNIT = __DEV__ ? TestIds.NATIVE : Platform.OS === 'ios' ? extra.adUnitNativeIos : extra.adUnitNativeAndroid;

// Evaluated once per launch so render stays pure; the grace period flips on the next launch after day 7.
const LAUNCHED_AT = Date.now();

/** Ads only after the 7-day grace period (spec §4). */
export function useAdsOn(): boolean {
  const { user } = useData();
  if (!user || !UNIT) return false;
  const signupAt = Date.parse(user.metadata.creationTime ?? '') || LAUNCHED_AT;
  return adsEnabled(signupAt, LAUNCHED_AT);
}

/** Native ad styled as a list row; non-personalised only (spec §4). Renders nothing if no fill. */
export function NativeAdRow() {
  const t = useTheme();
  const [ad, setAd] = useState<NativeAd | null>(null);
  useEffect(() => {
    let alive = true;
    let loaded: NativeAd | null = null;
    NativeAd.createForAdRequest(UNIT, { requestNonPersonalizedAdsOnly: true })
      .then((a) => {
        loaded = a;
        if (alive) setAd(a);
        else a.destroy();
      })
      .catch(() => {});
    return () => {
      alive = false;
      loaded?.destroy();
    };
  }, []);
  if (!ad) return null;
  return (
    <NativeAdView nativeAd={ad} style={{ padding: 12, borderRadius: 10, backgroundColor: t.card, marginVertical: 4 }}>
      <Text style={{ color: t.muted, fontSize: 11 }}>Sponsored</Text>
      <NativeAsset assetType={NativeAssetType.HEADLINE}>
        <Text style={{ color: t.fg, fontWeight: '600' }}>{ad.headline}</Text>
      </NativeAsset>
      <NativeAsset assetType={NativeAssetType.BODY}>
        <Text style={{ color: t.muted }} numberOfLines={2}>
          {ad.body}
        </Text>
      </NativeAsset>
      <View style={{ alignItems: 'flex-start', marginTop: 6 }}>
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>{ad.callToAction}</Text>
        </NativeAsset>
      </View>
    </NativeAdView>
  );
}
