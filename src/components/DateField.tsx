import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, View } from 'react-native';
import { T, useTheme } from './ui';

/** iOS: native compact picker. Android: date dialog, then time dialog for 'datetime'. */
export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
}: {
  label: string;
  value: number;
  onChange: (t: number) => void;
  mode?: 'date' | 'datetime';
}) {
  const t = useTheme();
  if (Platform.OS === 'ios') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T muted size={13}>
          {label}
        </T>
        <DateTimePicker value={new Date(value)} mode={mode} display="compact" onChange={(_, d) => d && onChange(d.getTime())} />
      </View>
    );
  }
  const text = new Date(value).toLocaleString(
    'en-IN',
    mode === 'date' ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' },
  );
  const open = () =>
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'date',
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return;
        if (mode === 'date') return onChange(d.getTime());
        DateTimePickerAndroid.open({ value: d, mode: 'time', onChange: (e2, d2) => e2.type === 'set' && d2 && onChange(d2.getTime()) });
      },
    });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${text}`} onPress={open} style={{ gap: 4 }}>
      <T muted size={13}>
        {label}
      </T>
      <T style={{ color: t.accent }}>{text}</T>
    </Pressable>
  );
}
