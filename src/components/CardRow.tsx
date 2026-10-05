import { Image, Pressable, Text, View } from 'react-native';
import { fmtDate } from '@/lib/time';
import type { Card } from '@/lib/types';
import { T, useTheme } from './ui';

export function Avatar({ name, uri, size = 44 }: { name: string; uri?: string; size?: number }) {
  const t = useTheme();
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.fg, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

export function CardRow({ card, eventName, selected, onPress }: { card: Card; eventName?: string; selected?: boolean; onPress?: () => void }) {
  const t = useTheme();
  const title = card.name || (card.pending ? 'Loading details…' : card.company || card.phones[0] || 'Unnamed card');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: selected ? t.card : 'transparent' }}
    >
      <Avatar name={card.name} uri={card.photoUrl} />
      <View style={{ flex: 1 }}>
        <T bold numberOfLines={1}>
          {title}
        </T>
        {!!card.company && card.name !== '' && (
          <T muted numberOfLines={1}>
            {card.company}
          </T>
        )}
        <T muted size={13} numberOfLines={1}>
          {[eventName ?? card.place?.label, fmtDate(card.metAt)].filter(Boolean).join(' · ')}
        </T>
      </View>
    </Pressable>
  );
}
