import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useColorScheme, type TextInputProps, type TextStyle } from 'react-native';

export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    fg: dark ? '#eeeeee' : '#111111',
    bg: dark ? '#111111' : '#ffffff',
    muted: dark ? '#aaaaaa' : '#5f6368',
    card: dark ? '#1c1c1e' : '#f2f2f7',
    border: dark ? '#333333' : '#dddddd',
    accent: dark ? '#58a6ff' : '#1f6feb',
    danger: '#d1242f',
  };
}

export const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  if (!scroll) return <View style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>{children}</View>;
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function T({
  children,
  muted,
  size = 16,
  bold,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  muted?: boolean;
  size?: number;
  bold?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: muted ? t.muted : t.fg, fontSize: size, fontWeight: bold ? '700' : '400' }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const t = useTheme();
  const solid = kind === 'primary';
  const color = kind === 'danger' ? t.danger : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: solid ? color : 'transparent',
        borderWidth: solid ? 0 : 2,
        borderColor: color,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: solid ? '#fff' : color, fontWeight: '600', fontSize: 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <T muted size={13}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        style={{ borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 12, color: t.fg, fontSize: 16 }}
        {...props}
      />
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: active }}
      disabled={!onPress}
      onPress={onPress}
      style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: active ? t.accent : t.card, marginRight: 8 }}
    >
      <Text style={{ color: active ? '#fff' : t.fg }}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ text, onPress }: { text: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 12, borderRadius: 10, backgroundColor: t.card, marginBottom: 8 }}>
      <Text style={{ color: t.accent, fontWeight: '600' }}>{text}</Text>
    </Pressable>
  );
}
