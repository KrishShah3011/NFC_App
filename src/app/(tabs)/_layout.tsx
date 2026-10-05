import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useData } from '@/lib/store';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) =>
  function TabBarIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };

export default function TabsLayout() {
  const { profile } = useData();
  if (!profile) return <Redirect href="/profile-edit" />;
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Share', tabBarIcon: icon('qr-code-outline') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: icon('scan-outline') }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards', tabBarIcon: icon('albums-outline') }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
